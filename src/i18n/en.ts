const en = {
  appName: 'Family Score Keeper',
  tagline: 'Keep score. Settle it. Play again.',
  back: 'Back',
  next: 'Next',
  working: 'One moment…',
  cancel: 'Cancel',
  errorGeneric: 'Something went wrong. Check your internet and try again.',
  language: 'Language',

  // Welcome
  startNew: 'Start a new family',
  startNewSub: 'You will be the admin',
  joinCode: 'Join with a code',
  joinCodeSub: 'Someone in your family has the code',

  // Create family
  startH: 'Start your family',
  startSub: 'Give your family a name, then tell us who you are.',
  fldFamily: 'Family name',
  familyDefault: 'Our Family',
  fldName: 'Your first name',
  needYourName: 'Please type your name first.',
  needPhoto: 'Please take a selfie first.',
  createBtn: 'Create my family',
  adminNote: 'You will be the admin. You approve everyone who joins, and you can make a second admin later.',
  selfieH: 'Your selfie',
  selfieSub: 'Everyone in the family sees it next to their name.',

  // Join
  joinH: 'Join your family',
  joinSub: 'Type or paste the six words from your family. English or Polish both work.',
  fldCode: 'Six-word code',
  paste: 'Paste',
  badCode: 'We could not find that code. Check the words and try again.',
  tooManyTries: 'Too many wrong codes. Please try again in an hour.',
  whoH: 'Who are you?',
  whoSub: 'The admin will see your name and selfie before letting you in.',
  joinPhotoH: 'Take a selfie',
  joinPhotoSub: 'So the admin knows it is you.',
  joinPhotoNeeded: 'A selfie is needed to join. Please take one.',
  joinBtn: 'Ask to join',

  // Waiting
  waitingH: 'Waiting for the admin',
  waitingBody: 'Your family admin needs to say yes. This page opens by itself when they do.',
  waitingCheck: 'Check again',
  stillWaiting: 'Not yet. We will keep checking.',
  requestMissing: 'Your request is gone. Start over and enter the code again.',
  checkFailed: 'Could not check. Try again in a moment.',
  waitingNoPhoto: 'Your selfie did not upload. Please take it again.',
  startOver: 'Start over',
  startOverSure: 'This phone will forget this request, and you can enter the code again.',
  declinedH: 'Not this time',
  declinedBody: 'The admin did not accept this request. Ask them in person, then start over.',
  myPhotoFailed: 'The photo did not save. Please try again.',

  // Created
  createdH: 'Your family is ready!',
  createdSub: 'Share these six words with the people who should join.',
  codeLabel: 'Family code',
  codeNote: 'Anyone with these words can ask to join, but you still approve them one by one.',
  sendCode: 'Send the code',
  copyCode: 'Copy the code',
  copied: 'Copied!',
  openApp: 'Continue',

  // Home
  homeH: 'Hello, {name}!',
  familyBtn: 'Family and members',
  pendingBadge_one: '{count} person is waiting',
  pendingBadge_other: '{count} people are waiting',
  comingSoon: 'Games are coming in the next step.',

  // Family
  familyH: 'Family',
  peopleCount_one: '{count} person',
  peopleCount_other: '{count} people',
  membersH: 'Members',
  you: 'You',
  admin: 'Admin',
  adminYou: 'Admin · You',
  makeAdmin: 'Make admin',
  removeBtn: 'Remove',
  removeH: 'Remove {name}?',
  removeSure: 'They lose access right away. Their past games stay in the history.',
  pendingH: 'Waiting to join',
  pendingSure: 'Only approve people you know.',
  wantsToJoin: 'Wants to join',
  approve: 'Approve',
  decline: 'Decline',
  approveFailed: 'That did not work. Try again.',
  familyCode: 'Family code',
  sendShort: 'Send',
  newCodeBtn: 'New code',
  signOut: 'Sign out of this phone',
  signOutSure: 'You will need the family code and the admin to let you back in.',

  // New code
  newCodeH: 'Make a new code?',
  nc1: 'The old code will stop working right away.',
  nc2: 'People already in the family stay in.',
  nc3: 'Send the new code to anyone who still needs to join.',
  yesNew: 'Yes, make a new code',
  noKeep: 'No, keep the old one',

  // Photo
  addPhoto: 'Add your selfie',
  changePhoto: 'Change your selfie',
  photoSub: 'Tap to take a new one.',
  photoTakeBtn: 'Take a selfie',
  photoNoCamera: 'The camera is turned off for this app. Turn it on in Settings.',
} as const;

export type Dict = Record<keyof typeof en, string>;
export default en as Dict;
