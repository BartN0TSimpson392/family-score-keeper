import AsyncStorage from '@react-native-async-storage/async-storage';
import { FieldPath, arrayUnion, collection, deleteDoc, doc, onSnapshot, runTransaction, setDoc, updateDoc } from 'firebase/firestore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, ensureSignedIn } from '@/firebase';
import { playTrack, songFor } from './songs';
import { useFamily } from './store';
import { gameKeyFor, standings, type Rules } from './live';
import type { LiveGame, LivePlayer, Mode } from './types';

export * from './live';

const LIVE_KEY = 'fsk.live'; // games kept on this phone before games were shared; moved online the first time the app opens
const CURRENT_KEY = 'fsk.currentLive';
const NAMES_KEY = 'fsk.gameNames';
const RULES_KEY = 'fsk.gameRules';
const MAX_NAMES = 20;

export type GameStore = {
  ready: boolean;
  /** The game this phone is showing and scoring. Shared live with the whole family. */
  game: LiveGame | null;
  /** Every game in progress in the family, newest first. */
  liveGames: LiveGame[];
  /** Names of games played before on this phone, newest first. */
  recentNames: string[];
  /** Rules last used for a game name on this phone (even if that game was never saved). */
  rulesFor: (name: string) => Rules | undefined;
  startGame: (p: { name: string; mode: Mode; start: number; target: number | null; players: LivePlayer[]; dealer: boolean; firstDealerUid: string | null; penalty?: boolean; teams?: boolean; seats?: string[]; winBy?: number; scorer?: 'tap' | 'cornhole'; serve?: boolean; firstServerUid?: string | null }) => void;
  /** Adds one whole round. `points` holds each player's change in score. */
  addRound: (points: Record<string, number>) => void;
  /** Adds one player's points to the round being built. When every player has an entry it becomes a round. */
  enterPoints: (uid: string, delta: number) => void;
  /** Takes back the half-finished round, or the last round if there is none. */
  undo: () => void;
  /** Shows and scores a game that is in progress. */
  openGame: (id: string) => void;
  /** Ends the game for everyone (after saving it or throwing it away). */
  endGame: () => void;
};

const Ctx = createContext<GameStore | null>(null);

const warn = (what: string) => (e: unknown) => console.warn(what, (e as { code?: string })?.code ?? e);
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/** Converts a game saved by an older version (a list of single taps) to the current shape. */
function upgrade(raw: LiveGame & { log?: { uid: string; delta: number; at: number }[] }): LiveGame {
  const g = { ...raw };
  if (typeof g.start !== 'number') {
    if (g.mode === 'down' && g.target != null) {
      g.start = g.target;
      g.target = 0;
    } else {
      g.start = 0;
    }
  }
  if (!Array.isArray(g.rounds)) g.rounds = (g.log ?? []).map((e) => ({ points: { [e.uid]: e.delta }, at: e.at }));
  delete g.log;
  if (typeof g.dealer !== 'boolean') {
    g.dealer = false;
    g.firstDealerUid = null;
  }
  if (!g.pending) g.pending = {};
  return g;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { session, members } = useFamily();
  const fid = session.signedIn && !session.pending ? session.familyId : '';
  const myUid = session.uid;
  const myName = session.userName;

  const [live, setLive] = useState<LiveGame[]>([]);
  const [liveReady, setLiveReady] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, Rules>>({});
  const [ready, setReady] = useState(false);
  const legacy = useRef<LiveGame | null>(null);
  const lastAct = useRef(0);
  const won = useRef<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LIVE_KEY), AsyncStorage.getItem(NAMES_KEY), AsyncStorage.getItem(RULES_KEY), AsyncStorage.getItem(CURRENT_KEY)])
      .then(([rawGame, rawNames, rawRules, rawCurrent]) => {
        if (rawRules) setRules(JSON.parse(rawRules) as Record<string, Rules>);
        if (rawGame) legacy.current = upgrade(JSON.parse(rawGame) as LiveGame);
        if (rawNames) setRecentNames(JSON.parse(rawNames) as string[]);
        if (rawCurrent) setCurrentId(rawCurrent);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const pick = useCallback((id: string | null) => {
    setCurrentId(id);
    if (id) AsyncStorage.setItem(CURRENT_KEY, id).catch(() => {});
    else AsyncStorage.removeItem(CURRENT_KEY).catch(() => {});
  }, []);

  // Games in progress live online, so every phone in the family sees the same scores as they change.
  useEffect(() => {
    if (!fid) {
      setLive([]);
      setLiveReady(false);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    ensureSignedIn()
      .then(() => {
        if (cancelled) return;
        unsub = onSnapshot(
          collection(db, 'families', fid, 'liveGames'),
          (s) => {
            const list = s.docs.map((d) => upgrade({ ...(d.data() as Omit<LiveGame, 'id'>), id: d.id } as LiveGame));
            list.sort((a, b) => b.startedAt - a.startedAt);
            setLive(list);
            setLiveReady(true);
          },
          warn('Could not read the games in progress'),
        );
      })
      .catch(warn('Could not sign in'));
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [fid]);

  // A game started before games were shared moves online once, so an update never loses it.
  useEffect(() => {
    const g = legacy.current;
    if (!g || !ready || !liveReady || !fid) return;
    legacy.current = null;
    AsyncStorage.removeItem(LIVE_KEY).catch(() => {});
    if (live.some((x) => x.id === g.id)) return;
    const { id, ...rest } = { ...g, createdByUid: g.createdByUid ?? myUid, createdByName: g.createdByName ?? myName };
    setDoc(doc(db, 'families', fid, 'liveGames', id), rest).catch(warn('Could not move the game online'));
    pick(id);
  }, [ready, liveReady, fid, live, myUid, myName, pick]);

  const game = useMemo(() => live.find((g) => g.id === currentId) ?? null, [live, currentId]);
  const gameRef = useRef<LiveGame | null>(null);
  gameRef.current = game;
  const refOf = useCallback((id: string) => doc(db, 'families', fid, 'liveGames', id), [fid]);

  const startGame = useCallback<GameStore['startGame']>(
    ({ name, mode, start, target, players, dealer, firstDealerUid, penalty, teams, seats, winBy, scorer, serve, firstServerUid }) => {
      if (!fid) return;
      const gameName = name.trim();
      const g: LiveGame = {
        id: newId(),
        gameKey: gameKeyFor(gameName),
        gameName,
        mode,
        start,
        target,
        penalty: mode === 'up' && target != null && !!penalty,
        winBy: mode === 'up' && target != null && !penalty && winBy && winBy > 1 ? winBy : undefined,
        scorer,
        serve: !!serve,
        firstServerUid: serve ? firstServerUid ?? players[0]?.uid ?? null : null,
        teams: !!teams,
        seats: teams && dealer ? seats : undefined,
        firstDealerUid: dealer ? firstDealerUid ?? seats?.[0] ?? players[0]?.uid ?? null : null,
        dealer,
        startedAt: Date.now(),
        players,
        rounds: [],
        pending: {},
        createdByUid: myUid,
        createdByName: myName,
      };
      lastAct.current = Date.now();
      // Show it right away; the cloud copy follows.
      setLive((prev) => [g, ...prev.filter((x) => x.id !== g.id)]);
      pick(g.id);
      const { id, ...rest } = g;
      setDoc(doc(db, 'families', fid, 'liveGames', id), rest).catch(warn('Could not start the game'));
      setRules((prev) => {
        const next = { ...prev, [gameKeyFor(gameName)]: { mode, start, target, dealer, penalty: !!penalty, teams: !!teams, winBy } };
        AsyncStorage.setItem(RULES_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      setRecentNames((prev) => {
        const next = [gameName, ...prev.filter((n) => gameKeyFor(n) !== gameKeyFor(gameName))].slice(0, MAX_NAMES);
        AsyncStorage.setItem(NAMES_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [fid, myUid, myName, pick],
  );

  const rulesFor = useCallback((name: string) => rules[gameKeyFor(name)], [rules]);

  const addRound = useCallback<GameStore['addRound']>(
    (points) => {
      const g = gameRef.current;
      if (!g || !fid) return;
      lastAct.current = Date.now();
      // arrayUnion adds to the list without replacing it, so two phones adding at once both get through.
      updateDoc(refOf(g.id), { rounds: arrayUnion({ id: newId(), points, at: Date.now() }), pending: {} }).catch(warn('Could not add the round'));
    },
    [fid, refOf],
  );

  /** Moves a completed half-round into the list of rounds. Safe if two phones finish it at once. */
  const closeRoundIfDone = useCallback(
    (id: string) =>
      runTransaction(db, async (tx) => {
        const ref = refOf(id);
        const snap = await tx.get(ref);
        if (!snap.exists()) return;
        const d = snap.data() as LiveGame;
        const pending = d.pending ?? {};
        if (d.players.length > 0 && d.players.every((p) => p.uid in pending)) {
          tx.update(ref, { rounds: [...(d.rounds ?? []), { id: newId(), points: pending, at: Date.now() }], pending: {} });
        }
      }).catch(warn('Could not finish the round')),
    [refOf],
  );

  const enterPoints = useCallback<GameStore['enterPoints']>(
    (uid, delta) => {
      const g = gameRef.current;
      if (!g || !fid) return;
      lastAct.current = Date.now();
      updateDoc(refOf(g.id), new FieldPath('pending', uid), delta)
        .then(() => closeRoundIfDone(g.id))
        .catch(warn('Could not save the points'));
    },
    [fid, refOf, closeRoundIfDone],
  );

  const undo = useCallback(() => {
    const g = gameRef.current;
    if (!g || !fid) return;
    runTransaction(db, async (tx) => {
      const ref = refOf(g.id);
      const snap = await tx.get(ref);
      if (!snap.exists()) return;
      const d = snap.data() as LiveGame;
      if (Object.keys(d.pending ?? {}).length > 0) tx.update(ref, { pending: {} });
      else if ((d.rounds ?? []).length > 0) tx.update(ref, { rounds: d.rounds.slice(0, -1) });
    }).catch(warn('Could not undo'));
  }, [fid, refOf]);

  const endGame = useCallback(() => {
    const g = gameRef.current;
    pick(null);
    if (g && fid) deleteDoc(refOf(g.id)).catch(warn('Could not end the game'));
  }, [fid, refOf, pick]);

  // The phone that scores the winning point plays the winner's victory song.
  useEffect(() => {
    if (!game) return;
    const winners = standings(game).winnerUids;
    if (winners.length > 0 && !won.current[game.id]) {
      won.current[game.id] = true;
      if (Date.now() - lastAct.current < 8000) {
        const song = songFor(game, winners, members);
        if (song) void playTrack(song);
      }
    }
    if (winners.length === 0) won.current[game.id] = false;
  }, [game, members]);

  const value = useMemo<GameStore>(
    () => ({ ready: ready && (!fid || liveReady), game, liveGames: live, recentNames, rulesFor, startGame, addRound, enterPoints, undo, openGame: pick, endGame }),
    [ready, fid, liveReady, game, live, recentNames, rulesFor, startGame, addRound, enterPoints, undo, pick, endGame],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame must be used inside GameProvider');
  return v;
}
