import { createHash } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

/* ------------------------------------------------------------------------------------------------
 * Guess limiter for family codes.
 *
 * The app cannot read the list of codes. It asks this function, which counts wrong guesses and stops anyone who
 * keeps guessing. Right answers are never counted, so a family joining normally is never slowed down.
 *
 * A wrong guess counts against three things at once: the anonymous account making it, the network address it
 * comes from (stored only as a one-way hash), and everyone together.
 * ---------------------------------------------------------------------------------------------- */
const WINDOW_MS = 60 * 60 * 1000;
const MAX_WRONG_PER_ACCOUNT = 6;
const MAX_WRONG_PER_ADDRESS = 15;
const MAX_WRONG_ALL = 400;

const KEY_FORMAT = /^\d{1,4}(?:-\d{1,4}){5}$/;

type Counter = { count: number; windowStart: number };

function addressId(ip: string | undefined): string {
  const salt = 'family-score-keeper-v1';
  return 'ip_' + createHash('sha256').update(`${salt}:${ip ?? 'unknown'}`).digest('hex').slice(0, 32);
}

/** The caller's address. Google's front end adds the real one to the END of X-Forwarded-For; anything before it can be faked. */
function clientAddress(req: { headers?: Record<string, unknown>; ip?: string } | undefined): string | undefined {
  const xff = req?.headers?.['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff.join(',') : typeof xff === 'string' ? xff : '';
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : req?.ip;
}

function fresh(c: Counter | undefined, now: number): Counter {
  return !c || now - c.windowStart > WINDOW_MS ? { count: 0, windowStart: now } : c;
}

/** Runs `lookup` (which returns what a code points to, or null for a wrong code) with guess counting around it. */
async function guarded<T>(request: CallableRequest, lookup: () => Promise<T | null>): Promise<T | null> {
  const now = Date.now();
  const ids = [`uid_${request.auth?.uid}`, addressId(clientAddress(request.rawRequest)), 'all'];
  const limits = [MAX_WRONG_PER_ACCOUNT, MAX_WRONG_PER_ADDRESS, MAX_WRONG_ALL];
  const refs = ids.map((id) => db.collection('joinAttempts').doc(id));

  const found = await lookup();

  // Refuse before answering if anyone is already over the limit (so a locked-out guesser learns nothing).
  const counters = await db.getAll(...refs);
  const current = counters.map((s) => fresh(s.data() as Counter | undefined, now));
  if (current.some((c, i) => c.count >= limits[i])) {
    throw new HttpsError('resource-exhausted', 'Too many wrong codes. Please try again in an hour.');
  }

  if (found) return found;

  // A wrong code: count it.
  await db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...refs);
    snaps.forEach((s, i) => {
      const c = fresh(s.data() as Counter | undefined, now);
      tx.set(refs[i], { count: c.count + 1, windowStart: c.windowStart, updatedAt: FieldValue.serverTimestamp() });
    });
  });
  return null;
}

function signedIn(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  return request.auth.uid;
}

function keyFrom(request: CallableRequest): string {
  const key = String(request.data?.key ?? '');
  if (!KEY_FORMAT.test(key)) throw new HttpsError('invalid-argument', 'That is not a code.');
  return key;
}

export const lookupCode = onCall({ region: 'us-central1', maxInstances: 10 }, async (request) => {
  signedIn(request);
  const key = keyFrom(request);
  const hit = await guarded(request, async () => {
    const snap = await db.collection('codes').doc(key).get();
    return snap.exists ? { familyId: String(snap.data()?.familyId ?? '') } : null;
  });
  return { familyId: hit ? hit.familyId : null };
});
