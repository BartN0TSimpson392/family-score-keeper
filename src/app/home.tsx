import { Redirect, useRouter } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, Body, H1, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function Home() {
  const router = useRouter();
  const { t, plural } = useI18n();
  const { session, members, pendingMembers } = useFamily();
  const { game, endGame } = useGame();
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const me = members.find((m) => m.id === session.uid);
  const waiting = session.isAdmin ? pendingMembers.length : 0;

  // A game in progress is kept on this phone. Starting another one asks before throwing it away.
  const startNew = () => {
    if (!game) {
      router.push('/games');
      return;
    }
    Alert.alert(t('discardAndStartH'), t('discardAndStartSure', { name: game.gameName }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('discardAndStart'),
        style: 'destructive',
        onPress: () => {
          endGame();
          router.push('/games');
        },
      },
    ]);
  };

  return (
    <Screen
      bottom={
        <View style={{ gap: 12 }}>
          {game ? (
            <>
              <BigButton label={t('continueGame', { name: game.gameName })} onPress={() => router.push('/play')} />
              <BigButton label={t('newGameInstead')} tone="outline" height={64} onPress={startNew} />
            </>
          ) : (
            <BigButton label={t('startGame')} onPress={startNew} />
          )}
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
      <View style={styles.header}>
        <Avatar name={session.userName || '?'} tint={me?.tint ?? colors.border} photoUri={session.photoUri} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={styles.family}>{session.familyName}</Text>
        </View>
      </View>
      <H1>{t('homeH', { name: session.userName })}</H1>
      <Body>{plural('peopleCount', members.length)}</Body>
      {waiting > 0 ? <Body style={{ color: colors.primary, fontWeight: '700' }}>{plural('pendingBadge', waiting)}</Body> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 12 },
  family: { fontWeight: '700', fontSize: 22, color: colors.teal },
});
