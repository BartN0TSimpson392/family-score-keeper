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
  const { game } = useGame();
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const me = members.find((m) => m.id === session.uid);
  const waiting = session.isAdmin ? pendingMembers.length : 0;

  return (
    <Screen
      bottom={
        <View style={{ gap: 14 }}>
          {game ? (
            <BigButton label={t('continueGame', { name: game.gameName })} onPress={() => router.push('/play')} />
          ) : (
            <BigButton label={t('startGame')} onPress={() => router.push('/games')} />
          )}
          <BigButton
            label={t('familyBtn')}
            sub={waiting > 0 ? plural('pendingBadge', waiting) : undefined}
            tone="teal"
            height={84}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 12 },
  family: { fontWeight: '700', fontSize: 22, color: colors.teal },
});
