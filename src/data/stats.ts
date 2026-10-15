import type { Mode, SavedGame } from './types';

/*
 * All stats are worked out on the phone from the saved games, so there is nothing extra to keep in sync.
 *
 *  win   you are the only winner
 *  tie   you share the win (a game with no target that ended level)
 *  loss  somebody else won (head-to-head: they won and you did not)
 *  none  nobody won (head-to-head: neither of you won)
 */
export type Result = 'win' | 'loss' | 'tie' | 'none';

export type Tally = {
  played: number;
  wins: number;
  losses: number;
  ties: number;
  none: number;
  /** Wins as a percentage of the games that had a result (wins, losses and ties). Null when there are none yet. */
  winRate: number | null;
};

export type Streak = { type: 'win' | 'loss'; n: number };

export type ScoreStats = { average: number; best: number; games: number };

const newestFirst = (games: SavedGame[]) => [...games].sort((a, b) => b.endedAt - a.endedAt);

export function filterGames(games: SavedGame[], gameKey: string | null): SavedGame[] {
  return newestFirst(gameKey ? games.filter((g) => g.gameKey === gameKey) : games);
}

export function resultSolo(g: SavedGame, me: string): Result {
  const w = g.winnerUids;
  if (w.includes(me)) return w.length > 1 ? 'tie' : 'win';
  return w.length === 0 ? 'none' : 'loss';
}

export function resultVs(g: SavedGame, me: string, other: string): Result {
  const meWon = g.winnerUids.includes(me);
  const otherWon = g.winnerUids.includes(other);
  if (meWon && otherWon) return 'tie';
  if (meWon) return 'win';
  if (otherWon) return 'loss';
  return 'none';
}

export function tally(results: Result[]): Tally {
  const count = (r: Result) => results.filter((x) => x === r).length;
  const wins = count('win');
  const losses = count('loss');
  const ties = count('tie');
  const decided = wins + losses + ties;
  return {
    played: results.length,
    wins,
    losses,
    ties,
    none: count('none'),
    winRate: decided > 0 ? Math.round((100 * wins) / decided) : null,
  };
}

/** Consecutive wins (or losses) up to the latest game. A tie or a no-winner game ends it. Results are newest first. */
export function streakOf(results: Result[]): Streak | null {
  const first = results[0];
  if (first !== 'win' && first !== 'loss') return null;
  let n = 0;
  while (results[n] === first) n++;
  return { type: first, n };
}

/** Average and best score for one person across these games (newest first). "Best" follows the newest game's direction. */
export function scoreStats(games: SavedGame[], uid: string): ScoreStats | null {
  const scores: number[] = [];
  for (const g of games) {
    const p = g.players.find((x) => x.uid === uid);
    if (p) scores.push(p.score);
  }
  if (scores.length === 0) return null;
  const mode: Mode = games[0]?.mode ?? 'up';
  const sum = scores.reduce((a, b) => a + b, 0);
  return {
    average: Math.round((sum / scores.length) * 10) / 10,
    best: mode === 'up' ? Math.max(...scores) : Math.min(...scores),
    games: scores.length,
  };
}

export type Summary = {
  /** The games counted, newest first. */
  games: SavedGame[];
  results: Result[];
  tally: Tally;
  streak: Streak | null;
  last5: Result[];
};

function summarize(games: SavedGame[], results: Result[]): Summary {
  return { games, results, tally: tally(results), streak: streakOf(results), last5: results.slice(0, 5) };
}

/** You against one other person, using only the games you were both in. */
export function versus(allGames: SavedGame[], me: string, other: string, gameKey: string | null): Summary {
  const games = filterGames(allGames, gameKey).filter((g) => g.playerUids.includes(me) && g.playerUids.includes(other));
  return summarize(games, games.map((g) => resultVs(g, me, other)));
}

/** Your own record in the games you played. */
export function myRecord(allGames: SavedGame[], me: string, gameKey: string | null): Summary {
  const games = filterGames(allGames, gameKey).filter((g) => g.playerUids.includes(me));
  return summarize(games, games.map((g) => resultSolo(g, me)));
}

export type LeaderRow = { uid: string; name: string; tint: string; tally: Tally };

/** Everyone who has played, best first: most wins, then best win rate, then most games. */
export function leaderboard(allGames: SavedGame[], gameKey: string | null): LeaderRow[] {
  const games = filterGames(allGames, gameKey);
  const people = new Map<string, { name: string; tint: string; results: Result[] }>();
  for (const g of games) {
    for (const p of g.players) {
      // Newest first, so the first time we see someone is their latest name.
      const row = people.get(p.uid) ?? { name: p.name, tint: p.tint, results: [] };
      row.results.push(resultSolo(g, p.uid));
      people.set(p.uid, row);
    }
  }
  return [...people.entries()]
    .map(([uid, r]) => ({ uid, name: r.name, tint: r.tint, tally: tally(r.results) }))
    .sort((a, b) => b.tally.wins - a.tally.wins || (b.tally.winRate ?? -1) - (a.tally.winRate ?? -1) || b.tally.played - a.tally.played);
}
