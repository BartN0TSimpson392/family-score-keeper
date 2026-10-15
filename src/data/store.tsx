import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, deleteDoc, doc, getDoc, getDocFromServer, onSnapshot, orderBy, query, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { db, ensureSignedIn, functions } from '@/firebase';
import { deleteByUrl, uploadFile } from '@/firebase/storage';
import type { Lang } from '@/i18n';
import { TINTS } from '@/ui/theme';
import { newCodeKey, parseCode, wordsFor } from './codes';
import { standings, winnersOf } from './game';
import type { LiveGame, Member, SavedGame, Session } from './types';

/**
 * The only thing screens know about data. Everything shared lives in Firebase:
 *   families/{familyId}                 name, admin, current code
 *   families/{familyId}/members/{uid}   who is in the family
 *   codes/{codeKey}                     family code -> familyId (only the lookupCode function reads it)
 * Only "who am I on this phone" is kept locally.
 */
export type FamilyStore = {
  ready: boolean;
  session: Session;
  members: Member[];
  /** People who asked to join and are waiting for an admin (admins only see these). */
  pendingMembers: Member[];
  /** The person who created the family. They can never be removed. */
  creatorUid: string;
  /** Six words in the given UI language for the current family code. */
  codeFor: (lang: Lang) => string[];
  /** Starts a new family with this phone's person as admin. Throws if it could not be saved. */
  createFamily: (p: { familyName: string; userName: string; photoUri: string }) => Promise<void>;
  /** Returns false when the code is not recognised. Throws on network trouble. */
  joinFamily: (p: { code: string; userName: string; photoUri: string }) => Promise<boolean>;
  /** True when the code belongs to a family. Throws on network trouble or when too many wrong codes were tried. */
  checkCode: (code: string) => Promise<boolean>;
  /** Sets or changes this person's selfie (uploads it). Throws if it could not be saved. */
  setMyPhoto: (localUri: string) => Promise<void>;
  /** For a person waiting to be let in: asks the server right now. 'missing' means the request is gone. */
  refreshRequest: () => Promise<'approved' | 'waiting' | 'declined' | 'missing'>;
  approveMember: (uid: string) => Promise<void>;
  declineMember: (uid: string) => Promise<void>;
  makeAdmin: (uid: string) => Promise<void>;
  /** Removes someone's access. Their past games stay. */
  removeMember: (uid: string) => Promise<void>;
  /** Makes a new family code; the old one stops working. */
  newCode: () => Promise<void>;
  /** Every finished game, newest first. */
  games: SavedGame[];
  /** Saves a finished game for the whole family. Safe to call again after a failure. Throws if it could not be saved. */
  saveGame: (g: LiveGame) => Promise<void>;
  /** Deletes a saved game (allowed for whoever saved it, and for admins). */
  deleteGame: (id: string) => Promise<void>;
  signOut: () => void;
};

type Base = { signedIn: boolean; userName: string; uid: string; familyId: string; pending?: boolean };
type FamilyDoc = { name: string; adminUid: string; codeKey: string };

const SESSION_KEY = 'fsk.session';
const emptyBase: Base = { signedIn: false, userName: '', uid: '', familyId: '' };

const Ctx = createContext<FamilyStore | null>(null);

function randomTint() {
  return TINTS[Math.floor(Math.random() * TINTS.length)];
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [base, setBaseState] = useState<Base>(emptyBase);
  const [family, setFamily] = useState<FamilyDoc | null>(null);
  const [rawMembers, setMembers] = useState<Member[]>([]);
  const [games, setGames] = useState<SavedGame[]>([]);
  /** This person's own entry, watched while waiting for approval. */
  const [selfDoc, setSelfDoc] = useState<Partial<Member> | null>(null);
  const [ready, setReady] = useState(false);
  const baseRef = useRef<Base>(emptyBase);
  const refreshRequestRef = useRef<FamilyStore['refreshRequest'] | null>(null);
  baseRef.current = base;

  // What this phone remembers: who it is.
  useEffect(() => {
    AsyncStorage.getItem(SESSION_KEY)
      .then((raw) => {
        if (!raw) return;
        const s = JSON.parse(raw) as Partial<Base>;
        if (s.signedIn && s.familyId && s.uid) {
          setBaseState({ signedIn: true, userName: s.userName ?? '', uid: s.uid, familyId: s.familyId, pending: !!s.pending });
        }
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setBase = useCallback((b: Base) => {
    baseRef.current = b;
    setBaseState(b);
    if (b.signedIn) AsyncStorage.setItem(SESSION_KEY, JSON.stringify(b)).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  }, []);

  // While waiting for approval the only thing this phone may read is its own entry. When an admin approves it, the rest opens up.
  useEffect(() => {
    if (!base.signedIn || !base.pending || !base.familyId) {
      setSelfDoc(null);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    ensureSignedIn()
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          doc(db, 'families', base.familyId, 'members', base.uid),
          (snap) => {
            const data = snap.exists() ? (snap.data() as Partial<Member>) : null;
            setSelfDoc(data);
            if (data && !data.pending && !data.removed) setBase({ ...baseRef.current, pending: false });
          },
          (e) => console.warn('Could not read your request', (e as { code?: string })?.code ?? e),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [base.signedIn, base.pending, base.familyId, base.uid, setBase]);

  // While waiting, also ask again whenever the app comes back to the front and every 20 seconds (in case the live connection is slow).
  useEffect(() => {
    if (!base.signedIn || !base.pending) return;
    const check = () => {
      refreshRequestRef.current?.().catch(() => {});
    };
    const id = setInterval(check, 20000);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && check());
    check();
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [base.signedIn, base.pending]);

  // Live copy of the family from the cloud: updates on every phone as soon as something changes.
  useEffect(() => {
    if (!base.signedIn || !base.familyId || base.pending) {
      setFamily(null);
      setMembers([]);
      setGames([]);
      return;
    }
    let cancelled = false;
    const unsubs: (() => void)[] = [];
    const fail = (what: string) => (e: unknown) => console.warn(`Could not read ${what}`, (e as { code?: string })?.code ?? e);
    ensureSignedIn()
      .then(() => {
        if (cancelled) return;
        const fid = base.familyId;
        unsubs.push(
          onSnapshot(
            doc(db, 'families', fid),
            (s) => setFamily(s.exists() ? (s.data() as FamilyDoc) : null),
            (e) => {
              fail('the family')(e);
              // An admin removed this person: the family is no longer readable, so go back to the start.
              if ((e as { code?: string })?.code === 'permission-denied') setBase(emptyBase);
            },
          ),
        );
        unsubs.push(
          onSnapshot(
            collection(db, 'families', fid, 'members'),
            (s) => setMembers(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Member, 'id'>) }))),
            fail('the members'),
          ),
        );
        unsubs.push(
          onSnapshot(
            query(collection(db, 'families', fid, 'games'), orderBy('endedAt', 'desc')),
            (s) => setGames(s.docs.map((d) => ({ ...(d.data() as Omit<SavedGame, 'id'>), id: d.id }))),
            fail('the games'),
          ),
        );
      })
      .catch(fail('your account'));
    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [base.signedIn, base.familyId, base.pending, setBase]);

  const members = useMemo(
    () =>
      rawMembers
        .filter((m) => !m.removed && !m.pending)
        // The person who made the family is always an admin, whatever their entry says.
        .map((m) => (m.id === family?.adminUid ? { ...m, isAdmin: true } : m))
        .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.joinedAt - b.joinedAt),
    [rawMembers, family?.adminUid],
  );

  const pendingMembers = useMemo(
    () => rawMembers.filter((m) => m.pending && !m.removed).sort((a, b) => a.joinedAt - b.joinedAt),
    [rawMembers],
  );

  const setMemberField = useCallback(async (uid: string, patch: { isAdmin?: boolean; removed?: boolean; pending?: boolean }) => {
    const fid = baseRef.current.familyId;
    if (!fid) return;
    await updateDoc(doc(db, 'families', fid, 'members', uid), patch);
  }, []);
  const makeAdmin = useCallback((uid: string) => setMemberField(uid, { isAdmin: true }), [setMemberField]);
  const approveMember = useCallback((uid: string) => setMemberField(uid, { pending: false }), [setMemberField]);
  const declineMember = useCallback((uid: string) => setMemberField(uid, { removed: true, pending: false }), [setMemberField]);
  const removeMember = useCallback((uid: string) => setMemberField(uid, { removed: true }), [setMemberField]);

  const setMyPhoto = useCallback<FamilyStore['setMyPhoto']>(async (localUri) => {
    const { familyId, uid } = baseRef.current;
    if (!familyId || !uid) throw new Error('Not in a family');
    const ref = doc(db, 'families', familyId, 'members', uid);
    const old = ((await getDoc(ref)).data()?.photoUri as string | undefined) ?? undefined;
    const ext = localUri.split('?')[0].split('.').pop()?.toLowerCase() || 'jpg';
    const url = await uploadFile({ familyId, name: `profiles/${uid}-${Date.now()}.${ext}`, localUri });
    await updateDoc(ref, { photoUri: url });
    await deleteByUrl([old]);
  }, []);

  const refreshRequest = useCallback<FamilyStore['refreshRequest']>(async () => {
    const { familyId, uid } = baseRef.current;
    if (!familyId || !uid) return 'missing';
    await ensureSignedIn();
    const snap = await getDocFromServer(doc(db, 'families', familyId, 'members', uid));
    if (!snap.exists()) return 'missing';
    const data = snap.data() as Partial<Member>;
    setSelfDoc(data);
    if (data.removed) return 'declined';
    if (data.pending) return 'waiting';
    setBase({ ...baseRef.current, pending: false });
    return 'approved';
  }, [setBase]);
  refreshRequestRef.current = refreshRequest;

  const createFamily = useCallback<FamilyStore['createFamily']>(
    async ({ familyName, userName, photoUri }) => {
      const user = await ensureSignedIn();
      const familyRef = doc(collection(db, 'families'));
      const codeKey = newCodeKey();
      const batch = writeBatch(db);
      batch.set(familyRef, { name: familyName, adminUid: user.uid, codeKey, createdAt: Date.now() });
      batch.set(doc(db, 'codes', codeKey), { familyId: familyRef.id });
      batch.set(doc(db, 'families', familyRef.id, 'members', user.uid), {
        name: userName,
        isAdmin: true,
        joinedAt: Date.now(),
        tint: randomTint(),
      });
      await batch.commit();
      setBase({ signedIn: true, userName, uid: user.uid, familyId: familyRef.id });
      await setMyPhoto(photoUri).catch((e) => console.warn('Could not save the selfie', e));
    },
    [setBase, setMyPhoto],
  );

  /** Asks the server about a code. It counts wrong guesses and refuses people who keep guessing (error code "functions/resource-exhausted"). */
  const lookupCode = useCallback(async (code: string): Promise<{ key: string; familyId: string } | null> => {
    const key = parseCode(code);
    if (!key) return null;
    await ensureSignedIn();
    const res = await httpsCallable<{ key: string }, { familyId: string | null }>(functions, 'lookupCode')({ key });
    const familyId = res.data?.familyId;
    return familyId ? { key, familyId } : null;
  }, []);

  const joinFamily = useCallback<FamilyStore['joinFamily']>(
    async ({ code, userName, photoUri }) => {
      const found = await lookupCode(code);
      if (!found) return false;
      const user = await ensureSignedIn();
      const memberRef = doc(db, 'families', found.familyId, 'members', user.uid);
      // This phone may already be in the family (for example the admin signing back in): never overwrite that entry.
      let existing: Member | null = null;
      try {
        const snap = await getDoc(memberRef);
        if (snap.exists()) existing = { id: snap.id, ...(snap.data() as Omit<Member, 'id'>) };
      } catch {
        // Not a member yet, so reading is not allowed. That is expected.
      }
      if (!existing) {
        await setDoc(memberRef, {
          name: userName,
          isAdmin: false,
          pending: true,
          joinedAt: Date.now(),
          tint: randomTint(),
          joinCode: found.key,
        });
        // New people wait for an admin to approve them; until then they can only see the waiting screen.
        setBase({ signedIn: true, userName, uid: user.uid, familyId: found.familyId, pending: true });
        await setMyPhoto(photoUri).catch((e) => console.warn('Could not save the selfie', e));
        return true;
      }
      if (existing.pending || existing.removed) {
        setBase({ signedIn: true, userName: existing.name, uid: user.uid, familyId: found.familyId, pending: true });
        return true;
      }
      // Make sure we can really read the family now (a removed person cannot).
      await getDoc(doc(db, 'families', found.familyId));
      setBase({ signedIn: true, userName: existing.name, uid: user.uid, familyId: found.familyId });
      return true;
    },
    [lookupCode, setBase, setMyPhoto],
  );

  const newCode = useCallback(async () => {
    const fid = baseRef.current.familyId;
    if (!fid) return;
    const snap = await getDoc(doc(db, 'families', fid));
    const oldKey = snap.data()?.codeKey as string | undefined;
    const codeKey = newCodeKey();
    const batch = writeBatch(db);
    batch.update(doc(db, 'families', fid), { codeKey });
    if (oldKey) batch.delete(doc(db, 'codes', oldKey));
    batch.set(doc(db, 'codes', codeKey), { familyId: fid });
    await batch.commit();
  }, []);

  const saveGame = useCallback<FamilyStore['saveGame']>(async (g) => {
    const { familyId, uid } = baseRef.current;
    if (!familyId || !uid) throw new Error('Not in a family');
    await ensureSignedIn();
    const ref = doc(db, 'families', familyId, 'games', g.id);
    // A retry after a lost connection: if the first attempt did get through, there is nothing more to do.
    try {
      if ((await getDoc(ref)).exists()) return;
    } catch {
      // Could not check; try to save anyway.
    }
    const { scores } = standings(g);
    const saved: Omit<SavedGame, 'id'> = {
      gameKey: g.gameKey,
      gameName: g.gameName,
      mode: g.mode,
      start: g.start,
      target: g.target,
      penalty: !!g.penalty,
      ...(g.winBy ? { winBy: g.winBy } : {}),
      startedAt: g.startedAt,
      endedAt: Date.now(),
      createdByUid: uid,
      players: g.players.map((p) => ({
        uid: p.uid,
        name: p.name,
        tint: p.tint,
        score: scores[p.uid] ?? g.start,
        ...(p.members && p.members.length > 0
          ? { memberUids: p.members.map((m) => m.uid), members: p.members.map((m) => ({ uid: m.uid, name: m.name, tint: m.tint })) }
          : {}),
      })),
      playerUids: g.players.flatMap((p) => (p.members && p.members.length > 0 ? p.members.map((m) => m.uid) : [p.uid])),
      // One tap per point is too much detail to keep for every ping pong game.
      ...(g.scorer === 'tap' ? {} : { rounds: g.rounds.map((r) => ({ points: r.points })) }),
      winnerUids: winnersOf(g),
    };
    await setDoc(ref, saved);
  }, []);

  const deleteGame = useCallback<FamilyStore['deleteGame']>(async (id) => {
    const { familyId } = baseRef.current;
    if (!familyId) return;
    await deleteDoc(doc(db, 'families', familyId, 'games', id));
  }, []);

  const value = useMemo<FamilyStore>(() => {
    const session: Session = {
      ...base,
      familyName: family?.name ?? '',
      isAdmin: !base.pending && !!family && (family.adminUid === base.uid || !!rawMembers.find((m) => m.id === base.uid)?.isAdmin),
      pending: !!base.pending,
      declined: !!base.pending && !!selfDoc?.removed,
      photoUri: base.pending ? selfDoc?.photoUri : rawMembers.find((m) => m.id === base.uid)?.photoUri,
    };
    return {
      ready,
      session,
      members,
      pendingMembers,
      creatorUid: family?.adminUid ?? '',
      codeFor: (lang) => wordsFor(family?.codeKey, lang),
      createFamily,
      joinFamily,
      checkCode: async (code) => !!(await lookupCode(code)),
      setMyPhoto,
      refreshRequest,
      approveMember,
      declineMember,
      makeAdmin,
      removeMember,
      newCode,
      games,
      saveGame,
      deleteGame,
      signOut: () => setBase(emptyBase),
    };
  }, [base, family, rawMembers, selfDoc, ready, members, pendingMembers, createFamily, joinFamily, lookupCode, setMyPhoto, refreshRequest, approveMember, declineMember, makeAdmin, removeMember, newCode, games, saveGame, deleteGame, setBase]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFamily(): FamilyStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFamily must be used inside FamilyProvider');
  return v;
}
