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

export type LivePlayer = { uid: string; name: string; tint: string; photoUri?: string };

/** One tap on a score button. The scores are always worked out from this list, so Undo is just removing the last one. */
export type LiveEntry = { uid: string; delta: number; at: number };

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
  log: LiveEntry[];
};
