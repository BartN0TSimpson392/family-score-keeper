import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Redirect, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dealerFor, personName, serverFor, standings, useGame } from '@/data/game';
import { useI18n } from '@/i18n';
import { SideAvatar } from '@/ui/SideAvatar';
import { targetLine } from '@/ui/targetLine';

const GAP = 12;
const HEADER_H = 60;
const SIDE = 20;
const BOTTOM = 14;

/** Full-screen scoreboard for the whole room. Turns sideways, keeps the screen on, and is read-only. */
export default function Board() {
  const router = useRouter();
  const { t } = useI18n();
  const { game } = useGame();
  // The room is measured from the window itself, so it is right the moment the phone turns sideways.
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useKeepAwake();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUids, loserUids, leaders } = standings(game);
  const dealerUid = dealerFor(game, game.rounds.length);
  const dealerSide = game.players.find((p) => p.uid === dealerUid || p.members?.some((m) => m.uid === dealerUid))?.uid;
  const dealerLabel = game.teams ? personName(game, dealerUid) ?? t('dealerBadge') : t('dealerBadge');
  const lastRound = game.scorer === 'tap' ? undefined : game.rounds[game.rounds.length - 1];
  const serverUid = serverFor(game);
  const n = game.players.length;
  const boxW = Math.max(0, win.width - insets.left - insets.right - SIDE * 2);
  const boxH = Math.max(0, win.height - insets.top - insets.bottom - HEADER_H - BOTTOM);
  const rows = n <= 4 ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const cardW = Math.max(0, Math.floor((boxW - (cols - 1) * GAP) / cols) - 1);
  const cardH = Math.max(0, Math.floor((boxH - (rows - 1) * GAP) / rows) - 1);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{game.gameName}</Text>
        <Text style={styles.sub}>{targetLine(game, t)}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.close} hitSlop={10}>
          <Text style={styles.closeText}>✕ {t('close')}</Text>
        </Pressable>
      </View>

      <View style={[styles.area, { height: boxH + BOTTOM }]}>
        {boxW > 0
          ? game.players.map((p) => {
              const isWin = winnerUids.includes(p.uid);
              const isLead = leaders.includes(p.uid);
              return (
                <View key={p.uid} style={[styles.card, { width: cardW, height: cardH }, isLead && styles.lead, isWin && styles.win]}>
                  <View style={styles.who}>
                    <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={Math.min(64, Math.max(32, cardH * 0.2))} />
                    <Text style={[styles.name, { fontSize: Math.min(34, Math.max(18, cardH * 0.11)) }]} numberOfLines={1}>
                      {isWin ? '🏆 ' : loserUids.includes(p.uid) ? '💥 ' : isLead ? '👑 ' : ''}{p.name}
                    </Text>
                  </View>
                  {p.uid === dealerSide || p.uid === serverUid || lastRound ? (

                    <Text style={[styles.extra, { fontSize: Math.min(24, Math.max(14, cardH * 0.08)) }]} numberOfLines={1}>
                      {p.uid === dealerSide ? `🃏 ${dealerLabel}   ` : ''}{p.uid === serverUid ? `🏓 ${t('serving')}   ` : ''}
                      {lastRound ? `${(lastRound.points[p.uid] ?? 0) > 0 ? '+' : (lastRound.points[p.uid] ?? 0) < 0 ? '−' : ''}${Math.abs(lastRound.points[p.uid] ?? 0)}` : ''}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.score, { fontSize: Math.max(40, Math.min(cardH * 0.5, cardW * 0.5)) }]}
                    adjustsFontSizeToFit
                    minimumFontScale={0.3}
                    numberOfLines={1}
                    accessibilityLabel={`${p.name}: ${scores[p.uid]}`}
                  >
                    {scores[p.uid]}
                  </Text>
                </View>
              );
            })
          : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1525' },
  header: { height: HEADER_H, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: SIDE },
  title: { flexShrink: 1, fontWeight: '800', fontSize: 28, color: '#FFFFFF' },
  sub: { flex: 1, fontSize: 20, color: '#AEB8D0' },
  close: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 2, borderColor: '#AEB8D0', justifyContent: 'center' },
  closeText: { fontWeight: '700', fontSize: 18, color: '#FFFFFF' },
  area: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start', gap: GAP, paddingHorizontal: SIDE, paddingBottom: BOTTOM },
  card: { borderRadius: 24, backgroundColor: '#1B2440', borderWidth: 4, borderColor: '#1B2440', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  lead: { borderColor: '#5BD1B0' },
  win: { borderColor: '#F2C94C', backgroundColor: '#2B2A18' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontWeight: '700', color: '#FFFFFF' },
  extra: { fontWeight: '700', color: '#AEB8D0' },
  score: { textAlign: 'center', fontWeight: '800', color: '#FFFFFF' },
});
