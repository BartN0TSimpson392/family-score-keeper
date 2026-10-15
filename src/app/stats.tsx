import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { leaderboard, myRecord, scoreStats, versus, type Result, type Summary } from '@/data/stats';
import { useI18n } from '@/i18n';
import { Avatar, Body, H1, Screen, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Your record against any family member, in one game or in all of them. */
export default function Stats() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, games, members } = useFamily();
  const [who, setWho] = useState<string | null>(null); // null = everyone
  const [gameKey, setGameKey] = useState<string | null>(null); // null = all games

  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const me = members.find((m) => m.id === session.uid);
  const others = members.filter((m) => m.id !== session.uid);
  const opponent = who ? members.find((m) => m.id === who) : undefined;
  // One chip per game, using the most recent spelling of its name.
  const gameChips: [string, string][] = [];
  for (const g of games) if (!gameChips.some(([k]) => k === g.gameKey)) gameChips.push([g.gameKey, g.gameName]);

  const summary: Summary = opponent ? versus(games, session.uid, opponent.id, gameKey) : myRecord(games, session.uid, gameKey);
  const board = opponent ? [] : leaderboard(games, gameKey);
  const myScores = gameKey ? scoreStats(summary.games, session.uid) : null;
  const theirScores = gameKey && opponent ? scoreStats(summary.games, opponent.id) : null;
  const { tally, streak, last5 } = summary;
  const photoOf = (uid: string) => members.find((m) => m.id === uid)?.photoUri;
  const dash = '–';

  return (
    <Screen>
      <TopBar onBack={() => router.replace('/home')} backLabel={t('homeLink')} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }}>
        <H1>{t('statsH')}</H1>

        {games.length === 0 ? <Body>{t('noGamesYet')}</Body> : null}

        {others.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('statsWho')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              <Chip label={t('everyone')} on={who === null} onPress={() => setWho(null)} />
              {others.map((m) => (
                <Chip key={m.id} label={m.name} on={who === m.id} onPress={() => setWho(m.id)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {gameChips.length > 0 ? (
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>{t('statsGame')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              <Chip label={t('allGames')} on={gameKey === null} onPress={() => setGameKey(null)} />
              {gameChips.map(([key, name]) => (
                <Chip key={key} label={name} on={gameKey === key} onPress={() => setGameKey(key)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {games.length > 0 && tally.played === 0 ? <Body>{opponent ? t('notTogetherYet') : t('noGamesYet')}</Body> : null}

        {tally.played > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{opponent ? t('vsHeader', { name: opponent.name }) : t('yourRecord')}</Text>

            {opponent ? (
              <View style={styles.versus}>
                <View style={styles.side}>
                  <Avatar name={session.userName || '?'} tint={me?.tint ?? colors.border} photoUri={photoOf(session.uid)} size={64} />
                  <Text style={styles.sideName} numberOfLines={1}>{t('youLabel')}</Text>
                </View>
                <Text style={styles.bigNumber} accessibilityLabel={`${tally.wins} – ${tally.losses}`}>{tally.wins} – {tally.losses}</Text>
                <View style={styles.side}>
                  <Avatar name={opponent.name} tint={opponent.tint} photoUri={opponent.photoUri} size={64} />
                  <Text style={styles.sideName} numberOfLines={1}>{opponent.name}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.tiles}>
              <Tile label={opponent ? t('gamesTogether') : t('gamesPlayed')} value={String(tally.played)} />
              {!opponent ? <Tile label={t('winsLabel')} value={String(tally.wins)} /> : null}
              {!opponent ? <Tile label={t('lossesLabel')} value={String(tally.losses)} /> : null}
              <Tile label={t('tiesLabel')} value={String(tally.ties)} />
              <Tile label={opponent ? t('neitherWon') : t('noWinner')} value={String(tally.none)} />
              <Tile label={t('winRate')} value={tally.winRate == null ? dash : `${tally.winRate}%`} />
            </View>

            {streak ? <Text style={styles.streak}>{streak.type === 'win' ? '🔥 ' + t('streakWin', { n: streak.n }) : t('streakLoss', { n: streak.n })}</Text> : null}

            <View style={{ gap: 6 }}>
              <Text style={styles.label}>{t('last5')}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {last5.map((r, i) => (
                  <Dot key={i} result={r} text={{ win: t('resW'), loss: t('resL'), tie: t('resT'), none: t('resN') }[r]} />
                ))}
              </View>
            </View>

            {gameKey && myScores ? (
              <View style={{ gap: 6 }}>
                {theirScores && opponent ? <ScoreRow label="" mine={t('youLabel')} theirs={opponent.name} head /> : null}
                <ScoreRow label={t('avgScore')} mine={String(myScores.average)} theirs={theirScores ? String(theirScores.average) : undefined} />
                <ScoreRow label={t('bestScore')} mine={String(myScores.best)} theirs={theirScores ? String(theirScores.best) : undefined} />
              </View>
            ) : null}
          </View>
        ) : null}

        {!opponent && board.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('leaderboard')}</Text>
            {board.map((r, i) => (
              <View key={r.uid} style={styles.boardRow}>
                <Text style={styles.rank}>{i + 1}</Text>
                <Avatar name={r.name} tint={r.tint} photoUri={photoOf(r.uid)} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sideName} numberOfLines={1}>{r.uid === session.uid ? `${r.name} (${t('youLabel')})` : r.name}</Text>
                  <Text style={styles.small}>
                    {t('gamesPlayed')}: {r.tally.played}{r.tally.winRate == null ? '' : ` · ${t('winRate')}: ${r.tally.winRate}%`}
                  </Text>
                </View>
                <Text style={styles.boardWins}>{r.tally.wins}</Text>
              </View>
            ))}
          </View>
        ) : null}
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const DOT: Record<Result, string> = { win: colors.teal, loss: colors.primary, tie: '#C99700', none: '#8A93A8' };

function Dot({ result, text }: { result: Result; text: string }) {
  return (
    <View style={[styles.dot, { backgroundColor: DOT[result] }]}>
      <Text style={styles.dotText}>{text}</Text>
    </View>
  );
}

function ScoreRow({ label, mine, theirs, head }: { label: string; mine: string; theirs?: string; head?: boolean }) {
  const valueStyle = head ? styles.scoreHead : styles.scoreValue;
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={valueStyle} numberOfLines={1}>{mine}</Text>
      {theirs != null ? <Text style={valueStyle} numberOfLines={1}>{theirs}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 2, borderColor: colors.teal, justifyContent: 'center' },
  chipOn: { backgroundColor: colors.teal },
  chipText: { fontWeight: '700', fontSize: 18, color: colors.teal },
  card: { gap: 14, padding: 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  cardTitle: { fontWeight: '800', fontSize: 24, color: colors.ink },
  versus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  side: { alignItems: 'center', gap: 4, width: 84 },
  sideName: { fontWeight: '700', fontSize: 19, color: colors.ink },
  bigNumber: { fontWeight: '800', fontSize: 48, color: colors.ink },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { minWidth: 96, flexGrow: 1, flexBasis: '30%', padding: 10, borderRadius: 14, backgroundColor: colors.paper, alignItems: 'center', gap: 2 },
  tileValue: { fontWeight: '800', fontSize: 30, color: colors.ink },
  tileLabel: { fontSize: 15, lineHeight: 19, textAlign: 'center', color: colors.muted },
  streak: { fontWeight: '700', fontSize: 20, color: colors.ink },
  dot: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  dotText: { fontWeight: '800', fontSize: 20, color: '#FFFFFF' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreLabel: { flex: 1, fontSize: 19, color: colors.muted },
  scoreHead: { width: 84, textAlign: 'right', fontWeight: '700', fontSize: 16, color: colors.teal },
  scoreValue: { minWidth: 84, textAlign: 'right', fontWeight: '800', fontSize: 24, color: colors.ink },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 24, fontWeight: '800', fontSize: 22, color: colors.muted, textAlign: 'center' },
  small: { fontSize: 15, color: colors.muted },
  boardWins: { fontWeight: '800', fontSize: 32, color: colors.ink, minWidth: 40, textAlign: 'right' },
});
