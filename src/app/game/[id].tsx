import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, Body, ErrorText, H1, Screen, SmallButton, TopBar } from '@/ui/components';
import { formatDate, rulesLine } from '@/ui/format';
import { colors } from '@/ui/theme';

/** One saved game: final scores, who won, and (for the person who saved it, or an admin) a way to delete it. */
export default function GameDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { session, games, members, deleteGame } = useFamily();
  const [failed, setFailed] = useState(false);
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const g = games.find((x) => x.id === id);
  if (!g) {
    return (
      <Screen>
        <TopBar onBack={() => router.back()} />
        <Body>{t('gameNotFound')}</Body>
      </Screen>
    );
  }

  const canDelete = session.isAdmin || g.createdByUid === session.uid;
  const savedBy = members.find((m) => m.id === g.createdByUid)?.name;
  const photoOf = (uid: string) => members.find((m) => m.id === uid)?.photoUri;
  const sorted = [...g.players].sort((a, b) => (g.mode === 'up' ? b.score - a.score : a.score - b.score));

  const confirmDelete = () =>
    Alert.alert(t('deleteGameH'), t('deleteGameSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteGame'),
        style: 'destructive',
        onPress: () => {
          setFailed(false);
          deleteGame(g.id)
            .then(() => router.back())
            .catch((e) => {
              console.warn('Could not delete the game', (e as { code?: string })?.code ?? e);
              setFailed(true);
            });
        },
      },
    ]);

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
        <View style={{ gap: 4 }}>
          <H1>{g.gameName}</H1>
          <Body>{t('playedOn', { date: formatDate(g.endedAt, lang) })}</Body>
          <Body style={{ fontSize: 18 }}>{rulesLine(g, t)}</Body>
        </View>

        <Text style={styles.label}>
          {g.winnerUids.length === 0 ? t('noWinner') : g.winnerUids.length > 1 ? t('winnersLabel') : t('winnerLabel')}
        </Text>

        <View style={{ gap: 10 }}>
          {sorted.map((p) => {
            const won = g.winnerUids.includes(p.uid);
            return (
              <View key={p.uid} style={[styles.row, won && styles.rowWon]}>
                <Avatar name={p.name} tint={p.tint} photoUri={photoOf(p.uid)} size={56} />
                <Text style={styles.name} numberOfLines={1}>{won ? '🏆 ' : ''}{p.name}</Text>
                <Text style={styles.score}>{p.score}</Text>
              </View>
            );
          })}
        </View>

        {savedBy ? <Body style={{ fontSize: 16 }}>{t('savedBy', { name: savedBy })}</Body> : null}
        {failed ? <ErrorText>{t('deleteFailed')}</ErrorText> : null}
        {canDelete ? <SmallButton label={t('deleteGame')} style={{ minHeight: 56, borderColor: colors.danger }} onPress={confirmDelete} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  rowWon: { borderColor: '#E0B100', backgroundColor: '#FFFBEA' },
  name: { flex: 1, fontWeight: '700', fontSize: 22, color: colors.ink },
  score: { fontWeight: '800', fontSize: 34, color: colors.ink },
});
