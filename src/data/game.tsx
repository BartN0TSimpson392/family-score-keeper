import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { normalize } from './search';
import type { LiveGame, LivePlayer, Mode } from './types';

const LIVE_KEY = 'fsk.live';
const NAMES_KEY = 'fsk.gameNames';
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
  /** Whoever is currently ahead (can be several if tied). Empty before the first round. */
  leaders: string[];
};

/** Replays the rounds from the start, so Undo and "who won first" are always right. */
export function standings(g: LiveGame): Standings {
  const scores: Record<string, number> = {};
  for (const p of g.players) scores[p.uid] = g.start;
  let winnerUids: string[] = [];
  for (const r of g.rounds) {
    for (const p of g.players) scores[p.uid] += r.points[p.uid] ?? 0;
    if (winnerUids.length === 0 && g.target != null) {
      const reached = g.players.filter((p) => hasReached(g, scores[p.uid]));
      if (reached.length > 0) {
        const values = reached.map((p) => scores[p.uid]);
        const best = g.mode === 'up' ? Math.max(...values) : Math.min(...values);
        winnerUids = reached.filter((p) => scores[p.uid] === best).map((p) => p.uid);
      }
    }
  }
  let leaders: string[] = [];
  if (g.rounds.length > 0 && g.players.length > 0) {
    const values = g.players.map((p) => scores[p.uid]);
    const best = g.mode === 'up' ? Math.max(...values) : Math.min(...values);
    leaders = g.players.filter((p) => scores[p.uid] === best).map((p) => p.uid);
  }
  return { scores, winnerUids, leaders };
}

/** Who deals in the given round (0 is the first round). Null when the game does not track the dealer. */
export function dealerFor(g: Pick<LiveGame, 'dealer' | 'firstDealerUid' | 'players'>, roundIndex: number): string | null {
  if (!g.dealer || g.players.length === 0) return null;
  const first = Math.max(0, g.players.findIndex((p) => p.uid === g.firstDealerUid));
  return g.players[(first + roundIndex) % g.players.length].uid;
}

/** Who gets the win when the game is saved. A reached target wins. With no target, the best score wins (a tie shares it). A target nobody reached means no winner. */
export function winnersOf(g: LiveGame): string[] {
  const s = standings(g);
  if (s.winnerUids.length > 0) return s.winnerUids;
  if (g.target == null) return s.leaders;
  return [];
}

export type GameStore = {
  ready: boolean;
  game: LiveGame | null;
  /** Names of games played before on this phone, newest first. */
  recentNames: string[];
  startGame: (p: { name: string; mode: Mode; start: number; target: number | null; players: LivePlayer[]; dealer: boolean; firstDealerUid: string | null }) => void;
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(LIVE_KEY), AsyncStorage.getItem(NAMES_KEY)])
      .then(([rawGame, rawNames]) => {
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

  const startGame = useCallback<GameStore['startGame']>(({ name, mode, start, target, players, dealer, firstDealerUid }) => {
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
      dealer,
      firstDealerUid: dealer ? firstDealerUid ?? players[0]?.uid ?? null : null,
      rounds: [],
    });
    setRecentNames((prev) => {
      const next = [gameName, ...prev.filter((n) => gameKeyFor(n) !== gameKeyFor(gameName))].slice(0, MAX_NAMES);
      AsyncStorage.setItem(NAMES_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addRound = useCallback<GameStore['addRound']>((points) => {
    setGame((g) => (g ? { ...g, rounds: [...g.rounds, { points, at: Date.now() }] } : g));
  }, []);

  const undo = useCallback(() => {
    setGame((g) => (g && g.rounds.length ? { ...g, rounds: g.rounds.slice(0, -1) } : g));
  }, []);

  const endGame = useCallback(() => setGame(null), []);

  const value = useMemo<GameStore>(
    () => ({ ready, game, recentNames, startGame, addRound, undo, endGame }),
    [ready, game, recentNames, startGame, addRound, undo, endGame],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGame must be used inside GameProvider');
  return v;
}
