import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Redirect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dealerFor, personName, serverFor, standings, useGame } from '@/data/game';
import { useI18n } from '@/i18n';
import { RoundEntry } from '@/ui/RoundEntry';
import { SideAvatar } from '@/ui/SideAvatar';
import { targetLine } from '@/ui/targetLine';

const GAP = 12;
const HEADER_LANDSCAPE = 60;
const HEADER_PORTRAIT = 96;
const SIDE = 20;
const BOTTOM = 14;
const GOLD = '#F2C94C';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Full-screen scoreboard for the whole room. Turns with the phone, keeps the screen on, and tapping a score opens the round box. */
export default function Board() {
  const router = useRouter();
  const { t } = useI18n();
  const { game, addRound } = useGame();
  const [entering, setEntering] = useState(false);
  const [focusUid, setFocusUid] = useState<string | null>(null);
  // The room is measured from the window itself, so it is right the moment the phone turns sideways.
  const win = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useKeepAwake();

  useEffect(() => {
    // Follows the phone, portrait or landscape.
    ScreenOrientation.unlockAsync().catch(() => {});
  }, []);

  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUids, loserUids, leaders } = standings(game);
  const dealerUid = dealerFor(game, game.rounds.length);
  const dealerSide = game.players.find((p) => p.uid === dealerUid || p.members?.some((m) => m.uid === dealerUid))?.uid;
  const dealerLabel = game.teams ? personName(game, dealerUid) ?? t('dealerBadge') : t('dealerBadge');
  const lastRound = game.scorer === 'tap' ? undefined : game.rounds[game.rounds.length - 1];
  const serverUid = serverFor(game);
  const n = game.players.length;

  // Tapping a card adds to the next round: one point in tap games, otherwise the same round box as Add round opens, ready on that player.
  const tapCard = (uid: string) => {
    if (game.scorer === 'tap') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      addRound({ [uid]: 1 });
      return;
    }
    setFocusUid(uid);
    setEntering(true);
  };
  const portrait = win.height >= win.width;
  const headerH = portrait ? HEADER_PORTRAIT : HEADER_LANDSCAPE;
  const boxW = Math.max(0, win.width - insets.left - insets.right - SIDE * 2);
  const boxH = Math.max(0, win.height - insets.top - insets.bottom - headerH - BOTTOM);
  // Landscape: one row of up to 4, then two rows. Portrait: a single column of up to 4, then two columns.
  const cols = portrait ? (n <= 4 ? 1 : 2) : n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const cardW = Math.max(0, Math.floor((boxW - (cols - 1) * GAP) / cols) - 1);
  const cardH = Math.max(0, Math.floor((boxH - (rows - 1) * GAP) / rows) - 1);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.header, { height: headerH }]}>
        <View style={portrait ? { flex: 1 } : { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Text style={styles.title} numberOfLines={1}>{game.gameName}</Text>
          <Text style={[styles.sub, !portrait && { flex: 1 }]} numberOfLines={portrait ? 2 : 1}>{targetLine(game, t)}</Text>
        </View>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.close} hitSlop={10}>
          <Text style={styles.closeText}>✕ {t('close')}</Text>
        </Pressable>
      </View>

      <View style={[styles.area, { height: boxH + BOTTOM }]}>
        {boxW > 0
          ? game.players.map((p) => {
              const isWin = winnerUids.includes(p.uid);
              const isLead = leaders.includes(p.uid);
              const isLose = loserUids.includes(p.uid);
              // Whoever deals (or serves) gets the gold frame and a badge. Leading and winning are shown by the crown and trophy only.
              const badge = p.uid === dealerSide ? `🃏 ${dealerLabel}` : p.uid === serverUid ? `🏓 ${t('serving')}` : null;
              const change = lastRound ? lastRound.points[p.uid] ?? 0 : null;
              const marker = isWin ? '🏆 ' : isLose ? '💥 ' : isLead ? '👑 ' : '';
              const compact = cardH < 150;
              const avatarSize = compact ? clamp(cardH * 0.5, 36, 64) : clamp(Math.min(cardH * 0.4, cardW * 0.38), 40, 104);
              const nameSize = clamp(cardH * 0.13, 18, 36);
              const scoreSize = Math.max(36, Math.min(cardH * (compact ? 0.5 : 0.42), cardW * (compact ? 0.3 : 0.4)));
              const avatar = (
                <View style={[styles.ring, { borderRadius: avatarSize }, badge ? styles.ringGold : null]}>
                  <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={avatarSize} />
                </View>
              );
              const name = (
                <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={1}>{marker}{p.name}</Text>
              );
              const score = (
                <Text
                  style={[styles.score, { fontSize: scoreSize }, compact && { textAlign: 'left' }]}
                  adjustsFontSizeToFit
                  minimumFontScale={0.3}
                  numberOfLines={1}
                  accessibilityLabel={`${p.name}: ${scores[p.uid]}`}
                >
                  {scores[p.uid]}
                </Text>
              );
              return (
                <Pressable
                  key={p.uid}
                  onPress={() => tapCard(p.uid)}
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}: ${scores[p.uid]}`}
                  style={[styles.card, { width: cardW, height: cardH }, badge ? styles.dealer : null]}
                >
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={[styles.badgeText, { fontSize: clamp(cardH * 0.09, 14, 20) }]} numberOfLines={1}>{badge}</Text>
                    </View>
                  ) : null}
                  {change !== null ? (
                    <View style={styles.chip}>
                      <Text style={[styles.chipText, { fontSize: clamp(cardH * 0.09, 14, 20) }]}>{change > 0 ? '+' : change < 0 ? '−' : ''}{Math.abs(change)}</Text>
                    </View>
                  ) : null}
                  {compact ? (
                    <View style={styles.compactRow}>
                      {avatar}
                      <View style={{ flex: 1, paddingRight: 56 }}>
                        {name}
                        {score}
                      </View>
                    </View>
                  ) : (
                    <>
                      <View style={styles.who}>
                        {avatar}
                        {name}
                      </View>
                      {score}
                    </>
                  )}
                </Pressable>
              );
            })
          : null}
      </View>
      <RoundEntry visible={entering} onClose={() => setEntering(false)} focusUid={focusUid} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F1525' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: SIDE },
  title: { flexShrink: 1, fontWeight: '800', fontSize: 28, color: '#FFFFFF' },
  sub: { flex: 1, fontSize: 20, color: '#AEB8D0' },
  close: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 2, borderColor: '#AEB8D0', justifyContent: 'center' },
  closeText: { fontWeight: '700', fontSize: 18, color: '#FFFFFF' },
  area: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start', gap: GAP, paddingHorizontal: SIDE, paddingBottom: BOTTOM },
  card: { borderRadius: 24, backgroundColor: '#1B2440', borderWidth: 4, borderColor: '#1B2440', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  dealer: { borderColor: GOLD, backgroundColor: '#2B2A18' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 64 },
  compactRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ring: { borderWidth: 3, borderColor: 'transparent', padding: 1 },
  ringGold: { borderColor: GOLD },
  name: { flexShrink: 1, fontWeight: '700', color: '#FFFFFF' },
  score: { textAlign: 'right', fontWeight: '800', color: '#FFFFFF' },
  badge: { position: 'absolute', top: -14, right: 16, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 14, backgroundColor: GOLD },
  badgeText: { fontWeight: '800', color: '#3A2D00' },
  chip: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: '#0F1525' },
  chipText: { fontWeight: '700', color: '#AEB8D0' },
});
