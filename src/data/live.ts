import { normalize } from './search';
import type { LiveGame, Mode } from './types';

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
  // A round still being built one player at a time counts toward the scores shown, but nobody wins on a half-finished round.
  const pending = g.pending ?? {};
  for (const p of g.players) scores[p.uid] += pending[p.uid] ?? 0;
  let leaders: string[] = [];
  if ((g.rounds.length > 0 || Object.keys(pending).length > 0) && g.players.length > 0) {
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

/** The game with any half-finished round closed off as a round of its own (anyone missing scores nothing). Used when a game is saved. */
export function settle(g: LiveGame): LiveGame {
  const pending = g.pending ?? {};
  if (Object.keys(pending).length === 0) return { ...g, pending: {} };
  return { ...g, rounds: [...g.rounds, { points: pending, at: Date.now() }], pending: {} };
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

