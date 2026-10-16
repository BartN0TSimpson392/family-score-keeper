import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, Body, H1, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function Home() {
  const router = useRouter();
  const { t, plural } = useI18n();
  const { session, members, pendingMembers } = useFamily();
  const { liveGames, openGame } = useGame();
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const me = members.find((m) => m.id === session.uid);
  const waiting = session.isAdmin ? pendingMembers.length : 0;

  const sub = (g: (typeof liveGames)[number]) => {
    const who = g.createdByName || '';
    const n = g.rounds.length;
    return n === 0 ? t('liveSubNone', { name: who }) : n === 1 ? t('liveSubOne', { name: who }) : t('liveSub', { n, name: who });
  };

  return (
    <Screen
      bottom={
        <View style={{ gap: 12 }}>
          <BigButton label={liveGames.length > 0 ? t('newGameInstead') : t('startGame')} tone={liveGames.length > 0 ? 'outline' : 'primary'} height={liveGames.length > 0 ? 64 : undefined} onPress={() => router.push('/games')} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <BigButton label={t('historyShort')} tone="teal" height={72} style={{ flex: 1 }} onPress={() => router.push('/history')} />
            <BigButton label={t('statsBtn')} tone="teal" height={72} style={{ flex: 1 }} onPress={() => router.push('/stats')} />
          </View>
          <BigButton
            label={t('familyBtn')}
            sub={waiting > 0 ? plural('pendingBadge', waiting) : undefined}
            tone="outline"
            height={waiting > 0 ? 80 : 64}
            onPress={() => router.push('/family')}
          />
        </View>
      }
    >
      <Text style={styles.family}>{session.familyName}</Text>
      <View style={styles.me}>
        <Avatar name={session.userName || '?'} tint={me?.tint ?? colors.border} photoUri={session.photoUri} size={64} />
        <View style={{ flex: 1 }}>
          <H1>{t('homeH', { name: session.userName })}</H1>
        </View>
      </View>
      <Body>{plural('peopleCount', members.length)}</Body>
      {waiting > 0 ? <Body style={{ color: colors.primary, fontWeight: '700' }}>{plural('pendingBadge', waiting)}</Body> : null}

      {liveGames.length > 0 ? (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Text style={styles.live}>{t('liveH')}</Text>
          {liveGames.map((g) => (
            <BigButton
              key={g.id}
              label={t('liveContinue', { name: g.gameName })}
              sub={sub(g)}
              height={84}
              onPress={() => {
                openGame(g.id);
                router.push('/play');
              }}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: { fontWeight: '800', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.primary },
  me: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  family: { fontWeight: '800', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal, paddingTop: 12 },
});
