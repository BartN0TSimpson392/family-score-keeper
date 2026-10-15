import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, signInAnonymously, type Auth, type User } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth must be initialised once with AsyncStorage persistence so a phone stays signed in
// ("device recognition"). If it was already initialised (fast refresh), reuse it.
let auth: Auth;
try {
  auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
} catch {
  auth = getAuth(app);
}

export { auth };
// React Native can't always keep Firestore's streaming connection open, so let it fall back to long polling.
let firestore: Firestore;
try {
  firestore = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true });
} catch {
  firestore = getFirestore(app);
}
export const db = firestore;
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-central1');

/** Every phone gets an anonymous account, no password needed. Resolves with the signed-in user. */
export async function ensureSignedIn(): Promise<User> {
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
