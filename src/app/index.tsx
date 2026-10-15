import { Redirect } from 'expo-router';
import { useFamily } from '@/data/store';

/** Decides where this phone starts: the welcome screen, the waiting screen, or home. */
export default function Index() {
  const { ready, session } = useFamily();
  if (!ready) return null;
  return <Redirect href={!session.signedIn ? '/welcome' : session.pending ? '/waiting' : '/home'} />;
}
