import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Body, H1, Screen, TopBar } from '@/ui/components';
import { SideAvatar } from '@/ui/SideAvatar';
import { formatDate, rulesLine } from '@/ui/format';
import { colors } from '@/ui/theme';

/** Every finished game, newest first, with a filter for one game (like Blackjack). */
export default function History() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { session, games, members } = useFamily();
  const [filter, setFilter] = useState<string | null>(null);

  // One chip per game, using the most recent spelling of its name.
  const chips = useMemo(() => {
    const seen = new Map<string, string>();
    for (const g of games) if (!seen.has(g.gameKey)) seen.set(g.gameKey, g.gameName);
    return [...seen.entries()];
  }, [games]);

  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const shown = filter ? games.filter((g) => g.gameKey === filter) : games;
  const photoOf = (uid: string) => members.find((m) => m.id === uid)?.photoUri;

  return (
    <Screen>
      <TopBar onBack={() => router.replace('/home')} backLabel={t('homeLink')} />
      <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 24 }}>
        <H1>{t('historyH')}</H1>

        {chips.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            <Chip label={t('allGames')} on={filter === null} onPress={() => setFilter(null)} />
            {chips.map(([key, name]) => (
              <Chip key={key} label={name} on={filter === key} onPress={() => setFilter(key)} />
            ))}
          </ScrollView>
        ) : null}

        {shown.length === 0 ? <Body>{t('noGames')}</Body> : null}

        {shown.map((g) => (
          <Pressable
            key={g.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/game/[id]', params: { id: g.id } })}
            style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.top}>
              <Text style={styles.gameName} numberOfLines={1}>{g.gameName}</Text>
              <Text style={styles.date}>{formatDate(g.endedAt, lang)}</Text>
            </View>
            <Text style={styles.rules}>{rulesLine(g, t)}</Text>
            <View style={{ gap: 6 }}>
              {g.players.map((p) => (
                <View key={p.uid} style={styles.playerRow}>
                  <SideAvatar name={p.name} tint={p.tint} photoUri={photoOf(p.uid)} members={p.members} photoOf={photoOf} size={36} />
                  <Text style={[styles.pName, g.winnerUids.includes(p.uid) && { color: colors.ink }]} numberOfLines={1}>
                    {g.winnerUids.includes(p.uid) ? '🏆 ' : ''}{p.name}
                  </Text>
                  <Text style={styles.pScore}>{p.score}</Text>
                </View>
              ))}
            </View>
            {g.winnerUids.length === 0 ? <Text style={styles.rules}>{t('noWinner')}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipText, on && { color: colors.cream }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 2, borderColor: colors.teal, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.teal },
  chipText: { fontWeight: '700', fontSize: 18, color: colors.teal },
  card: { gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  top: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  gameName: { flex: 1, fontWeight: '800', fontSize: 24, color: colors.ink },
  date: { fontSize: 16, color: colors.muted },
  rules: { fontSize: 17, color: colors.muted },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pName: { flex: 1, fontWeight: '600', fontSize: 20, color: colors.muted },
  pScore: { fontWeight: '800', fontSize: 24, color: colors.ink },
});
