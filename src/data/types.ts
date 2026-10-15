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
