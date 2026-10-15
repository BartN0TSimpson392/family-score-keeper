export type Member = {
  id: string;
  name: string;
  isAdmin: boolean;
  joinedAt: number;
  tint: string;
  /** Web address of this person's selfie. */
  photoUri?: string;
  /** True until an admin approves a new person. They cannot see anything in the family before that. */
  pending?: boolean;
  /** Set when an admin removed this person. They lose access right away. */
  removed?: boolean;
};

export type Session = {
  signedIn: boolean;
  userName: string;
  /** This phone's anonymous Firebase user id. Also the id of this person in the family's member list. */
  uid: string;
  familyId: string;
  /** Filled in from the family document once it loads. */
  familyName: string;
  isAdmin: boolean;
  /** Waiting for an admin to approve this phone. */
  pending: boolean;
  /** An admin said no (or removed this person). */
  declined: boolean;
  /** This person's own selfie, once it is saved. */
  photoUri?: string;
};

/* ---------- A game being played right now (kept on this phone until it is finished) ---------- */

/** "up": add points until you reach the target. "down": start at the target and subtract until you reach zero. */
export type Mode = 'up' | 'down';

export type LiveMember = { uid: string; name: string; tint: string; photoUri?: string };

/** One side in a game. Usually one person. In a team game it is a whole team: `uid` is then a made-up id for the team and `members` lists the people on it. */
export type LivePlayer = { uid: string; name: string; tint: string; photoUri?: string; members?: LiveMember[] };

/** One round of play: how much each player's score changed. A player left out had no change. The scores are always worked out from the list of rounds, so Undo is just removing the last one. */
export type Round = { points: Record<string, number>; at: number };

export type LiveGame = {
  id: string;
  /** Lower-case, accent-free version of the name. Games with the same key share one history and one set of stats. */
  gameKey: string;
  gameName: string;
  mode: Mode;
  /** Where everyone starts. Always 0 when counting up. */
  start: number;
  /** The score that wins. Counting up: reach or pass it. Counting down: reach or go below it. Null (count up only) means the game ends when someone taps End game, and the best score wins. */
  target: number | null;
  startedAt: number;
  players: LivePlayer[];
  /** Penalty game (count up only): reaching the target LOSES, and the lowest score wins. */
  penalty?: boolean;
  /** Count up with a target: you must also lead by this many points (2 for ping pong). */
  winBy?: number;
  /** Games with their own scoring screen: 'tap' adds one point per tap, 'cornhole' scores bags with cancellation. */
  scorer?: 'tap' | 'cornhole';
  /** Tap games where the serve moves every few points (ping pong). */
  serve?: boolean;
  firstServerUid?: string | null;
  /** True when the sides are teams. */
  teams?: boolean;
  /** Team games with a dealer: the people in table order (teams sit alternately). The dealer moves down this list. */
  seats?: string[];
  /** True when the game tracks whose turn it is to deal (card games). */
  dealer: boolean;
  /** Who deals in round 1. The deal then moves to the next player in the list every round. */
  firstDealerUid: string | null;
  rounds: Round[];
};

/* ---------- A finished game, saved for the whole family ---------- */

/** One side of a saved game. For a team, `memberUids` and `members` say who was on it. */
export type SavedPlayer = {
  uid: string;
  name: string;
  tint: string;
  score: number;
  memberUids?: string[];
  members?: { uid: string; name: string; tint: string }[];
};

/** Stored at families/{familyId}/games/{id}. Never edited after saving; an admin or the person who saved it can delete it. */
export type SavedGame = {
  id: string;
  gameKey: string;
  gameName: string;
  mode: Mode;
  start: number;
  target: number | null;
  startedAt: number;
  endedAt: number;
  createdByUid: string;
  players: SavedPlayer[];
  /** Every person who played (the people on each team too), as a plain list so the stats can ask "every game that includes this person". */
  playerUids: string[];
  /** Penalty game: whoever reached the target lost and the lowest score won. */
  penalty?: boolean;
  winBy?: number;
  /** Round by round changes, like a score summary. Missing on games saved by older versions. */
  rounds?: { points: Record<string, number> }[];
  /** Usually one person. Several when a game with no target ends in a tie. Empty when nobody won. */
  winnerUids: string[];
};
