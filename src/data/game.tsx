import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalize } from './search';
import type { LiveGame, LivePlayer, Mode } from './types';

const LIVE_KEY = 'fsk.live';
const NAMES_KEY = 'fsk.gameNames';
const RULES_KEY = 'fsk.gameRules';
const MAX_NAMES = 20;

/** The same game typed in different ways ("Black Jack ", "blackjack") should not be two different games. */
export function gameKeyFor(name: string): string {
  return normalize(name).replace(/\s+/g, ' ');
}

function hasReached(g: Pick<LiveGame, 'mode' | 'target'>, score: number): boolean {
  if (g.target == null) return false;
  return g.mode === 'up' ? score >= g.target : score <= g.target;
}

export type Standings = {
  scores: Record<string, number>;
  /** The people who reached the target first (usually one; several if they reached it in the same round with the same score). Empty while nobody has, or when there is no target. */
  winnerUids: string[];
  /** Penalty games only: who reached the target and lost. */
  loserUids: string[];
  /** Whoever is currently ahead (can be several if tied). Empty before the first round. */
  leaders: string[];
};

/** Replays the rounds from the start, so Undo and "who won first" are always right. */
export function standings(g: LiveGame): Standings {
  const scores: Record<string, number> = {};
  for (const p of g.players) scores[p.uid] = g.start;
  let winnerUids: string[] = [];
  let loserUids: string[] = [];
  for (const r of g.rounds) {
    for (const p of g.players) scores[p.uid] += r.points[p.uid] ?? 0;
    if (winnerUids.length === 0 && loserUids.length === 0 && g.target != null) {
      const lead = (uid: string) => scores[uid] - Math.max(...g.players.filter((q) => q.uid !== uid).map((q) => scores[q.uid]));
      const mustLead = g.mode === 'up' && !g.penalty && (g.winBy ?? 1) > 1 ? g.winBy ?? 1 : 0;
      const reached = g.players.filter((p) => hasReached(g, scores[p.uid]) && (mustLead === 0 || lead(p.uid) >= mustLead));
      if (reached.length > 0 && g.penalty) {
        // Reaching the target loses. The lowest score at that moment wins.
        loserUids = reached.map((p) => p.uid);
        const low = Math.min(...g.players.map((p) => scores[p.uid]));
        winnerUids = g.players.filter((p) => scores[p.uid] === low && !loserUids.includes(p.uid)).map((p) => p.uid);
      } else if (reached.length > 0) {
        const values = reached.map((p) => scores[p.uid]);
        const best = g.mode === 'up' ? Math.max(...values) : Math.min(...values);
        winnerUids = reached.filter((p) => scores[p.uid] === best).map((p) => p.uid);
      }
    }
  }
  let leaders: string[] = [];
  if (g.rounds.length > 0 && g.players.length > 0) {
    const values = g.players.map((p) => scores[p.uid]);
    const best = g.mode === 'up' && !g.penalty ? Math.max(...values) : Math.min(...values);
    leaders = g.players.filter((p) => scores[p.uid] === best).map((p) => p.uid);
  }
  return { scores, winnerUids, loserUids, leaders };
}

/** Who serves the next point (ping pong): the serve moves every 2 points, every 5 in a game to 21, and every point once it is a tie one point short of the target. */
export function serverFor(g: LiveGame): string | null {
  if (!g.serve || g.players.length < 2) return null;
  const order = g.players.map((p) => p.uid);
  let idx = Math.max(0, order.indexOf(g.firstServerUid ?? ''));
  const scores: Record<string, number> = {};
  for (const p of g.players) scores[p.uid] = g.start;
  const normal = (g.target ?? 11) >= 21 ? 5 : 2;
  let since = 0;
  for (const r of g.rounds) {
    for (const p of g.players) scores[p.uid] += r.points[p.uid] ?? 0;
    since++;
    const deuce = g.target != null && g.players.every((p) => scores[p.uid] >= g.target! - 1);
    if (since >= (deuce ? 1 : normal)) {
      idx = (idx + 1) % order.length;
      since = 0;
    }
  }
  return order[idx];
}

/** Who deals in the given round (0 is the first round). Null when the game does not track the dealer. */
export function dealerFor(g: Pick<LiveGame, 'dealer' | 'firstDealerUid' | 'players' | 'seats'>, roundIndex: number): string | null {
  if (!g.dealer) return null;
  const seats = g.seats && g.seats.length > 0 ? g.seats : g.players.map((p) => p.uid);
  if (seats.length === 0) return null;
  const first = Math.max(0, seats.indexOf(g.firstDealerUid ?? ''));
  return seats[(first + roundIndex) % seats.length];
}

/** A person's name, whether they play alone or on a team. */
export function personName(g: Pick<LiveGame, 'players'>, uid: string | null): string | undefined {
  if (!uid) return undefined;
  for (const p of g.players) {
    if (p.uid === uid) return p.name;
    const m = p.members?.find((x) => x.uid === uid);
    if (m) return m.name;
  }
  return undefined;
}

/** Everyone who plays, team members included. */
export function peopleIn(g: Pick<LiveGame, 'players'>): { uid: string; name: string }[] {
  return g.players.flatMap((p) => (p.members && p.members.length > 0 ? p.members : [p]));
}

/** Who gets the win when the game is saved. A reached target wins. With no target, the best score wins (a tie shares it). A target nobody reached means no winner. */
export function winnersOf(g: LiveGame): string[] {
  const s = standings(g);
  if (s.winnerUids.length > 0) return s.winnerUids;
  if (g.target == null) return s.leaders;
  if (g.penalty && s.loserUids.length > 0) return s.winnerUids;
  return [];
}

/** The rules a game was last started with on this phone, so picking it again fills them in. */
export type Rules = { mode: Mode; start: number; target: number | null; dealer: boolean; penalty?: boolean; teams?: boolean; winBy?: number };

export type GameStore = {
  ready: boolean;
  game: LiveGame | null;
  /** Names of games played before on this phone, newest first. */
  recentNames: string[];
  /** Rules last used for a game name on this phone (even if that game was never saved). */
  rulesFor: (name: string) => Rules | undefined;
  startGame: (p: { name: string; mode: Mode; start: number; target: number | null; players: LivePlayer[]; dealer: boolean; firstDealerUid: string | null; penalty?: boolean; teams?: boolean; seats?: string[]; winBy?: number; scorer?: 'tap' | 'cornhole'; serve?: boolean; firstServerUid?: string | null }) => void;
  /** Adds one round. `points` holds each player's change in score. */
  addRound: (points: Record<string, number>) => void;
  undo: () => void;
  /** Clears the game on this phone. */
  endGame: () => void;
};

const Ctx = createContext<GameStore | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [game, setGame] = useState<LiveGame | null>(null);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, Rules>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LIVE_KEY), AsyncStorage.getItem(NAMES_KEY), AsyncStorage.getItem(RULES_KEY)])
      .then(([rawGame, rawNames, rawRules]) => {
        if (rawRules) setRules(JSON.parse(rawRules) as Record<string, Rules>);
        if (rawGame) {
          const saved = JSON.parse(rawGame) as LiveGame;
          if (typeof saved.start !== 'number') {
            if (saved.mode === 'down' && saved.target != null) {
              saved.start = saved.target;
              saved.target = 0;
            } else {
              saved.start = 0;
            }
          }
          // Games from the first version were a list of single taps; each tap becomes its own round.
          const old = saved as LiveGame & { log?: { uid: string; delta: number; at: number }[] };
          if (!Array.isArray(old.rounds)) old.rounds = (old.log ?? []).map((e) => ({ points: { [e.uid]: e.delta }, at: e.at }));
          delete old.log;
          if (typeof old.dealer !== 'boolean') {
            old.dealer = false;
            old.firstDealerUid = null;
          }
          setGame(old);
        }
        if (rawNames) setRecentNames(JSON.parse(rawNames) as string[]);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Every change is saved, so closing the app never loses a game in progress.
  useEffect(() => {
    if (!ready) return;
    if (game) AsyncStorage.setItem(LIVE_KEY, JSON.stringify(game)).catch(() => {});
    else AsyncStorage.removeItem(LIVE_KEY).catch(() => {});
  }, [game, ready]);

  const startGame = useCallback<GameStore['startGame']>(({ name, mode, start, target, players, dealer, firstDealerUid, penalty, teams, seats, winBy, scorer, serve, firstServerUid }) => {
    const gameName = name.trim();
    setGame({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      gameKey: gameKeyFor(gameName),
      gameName,
      mode,
      start,
      target,
      startedAt: Date.now(),
      players,
      penalty: mode === 'up' && target != null && !!penalty,
      dealer,
      winBy: mode === 'up' && target != null && !penalty && winBy && winBy > 1 ? winBy : undefined,
      scorer,
      serve: !!serve,
      firstServerUid: serve ? firstServerUid ?? players[0]?.uid ?? null : null,
      teams: !!teams,
      seats: teams && dealer ? seats : undefined,
      firstDealerUid: dealer ? firstDealerUid ?? seats?.[0] ?? players[0]?.uid ?? null : null,
      rounds: [],
    });
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
  }, []);

  const rulesFor = useCallback((name: string) => rules[gameKeyFor(name)], [rules]);

  const addRound = useCallback<GameStore['addRound']>((points) => {
    setGame((g) => (g ? { ...g, rounds: [...g.rounds, { points, at: Date.now() }] } : g));
  }, []);

  const undo = useCallback(() => {
    setGame((g) => (g && g.rounds.length ? { ...g, rounds: g.rounds.slice(0, -1) } : g));
  }, []);

  const endGame = useCallback(() => setGame(null), []);

  const value = useMemo<GameStore>(
    () => ({ ready, game, recentNames, rulesFor, startGame, addRound, undo, endGame }),
    [ready, game, recentNames, rulesFor, startGame, addRound, undo, endGame],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame must be used inside GameProvider');
  return v;
}
