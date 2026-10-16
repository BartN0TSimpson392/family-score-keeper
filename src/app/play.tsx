import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { dealerFor, personName, serverFor, standings, useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, ErrorText, SmallButton } from '@/ui/components';
import { RoundEntry } from '@/ui/RoundEntry';
import { SideAvatar } from '@/ui/SideAvatar';
import { RoundsTable } from '@/ui/RoundsTable';
import { colors } from '@/ui/theme';
import { targetLine } from '@/ui/targetLine';
import { SafeAreaView } from 'react-native-safe-area-context';

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export default function Play() {
  const router = useRouter();
  const { t } = useI18n();
  const { game, addRound, undo, endGame } = useGame();
  const { saveGame } = useFamily();
  const [saving, setSaving] = useState(false);
  const [entering, setEntering] = useState(false);
  const win = useWindowDimensions();
  const sideways = win.width > win.height;

  // This screen turns with the phone. It goes back to portrait when the game screen is left.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);
  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUids, loserUids, leaders } = standings(game);
  const losers = game.players.filter((p) => loserUids.includes(p.uid));
  const winners = game.players.filter((p) => winnerUids.includes(p.uid));
  const roundNo = game.rounds.length + 1;
  const isTap = game.scorer === 'tap';
  const serverUid = serverFor(game);

  const tapPoint = (uid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    addRound({ [uid]: 1 });
  };

  const dealerUid = dealerFor(game, game.rounds.length);
  const dealerName = personName(game, dealerUid);
  const lastRound = game.rounds[game.rounds.length - 1];

  const openEntry = () => setEntering(true);

  const saveAndLeave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await saveGame(game);
      endGame();
      router.replace('/history');
    } catch (e) {
      console.warn('Could not save the game', (e as { code?: string })?.code ?? e);
      Alert.alert(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    endGame();
    router.replace('/home');
  };

  const confirmEnd = () => {
    if (game.rounds.length === 0) {
      Alert.alert(t('endGameH'), t('noPointsYet'), [
        { text: t('cancel'), style: 'cancel' },
        { text: t('discardGame'), style: 'destructive', onPress: discard },
      ]);
      return;
    }
    Alert.alert(t('endGameH'), t('endGameSure'), [
      { text: t('saveToHistory'), onPress: () => void saveAndLeave() },
      { text: t('discardGame'), style: 'destructive', onPress: discard },
      { text: t('cancel'), style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/home')} accessibilityRole="button" accessibilityLabel={t('homeLink')} style={styles.back} hitSlop={8}>
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.gameName} numberOfLines={1}>{game.gameName}</Text>
          <Text style={styles.gameSub}>{targetLine(game, t)}</Text>
        </View>
        <SmallButton label={t('fullScreen')} tone="primary" style={{ minHeight: 48 }} onPress={() => router.push('/board')} />
      </View>

      {isTap ? (
        <View style={{ flex: 1, gap: 12, padding: 16, flexDirection: sideways ? 'row' : 'column' }}>
          {winners.length > 0 && !sideways ? (
            <View style={styles.winner} accessibilityRole="alert">
              <Text style={styles.winnerText}>🏆 {t('winnerBanner', { name: winners.map((w) => w.name).join(' & ') })}</Text>
            </View>
          ) : null}
          {game.players.map((p) => {
            const isWinner = winnerUids.includes(p.uid);
            return (
              <Pressable
                key={p.uid}
                onPress={() => tapPoint(p.uid)}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}: ${scores[p.uid]}. ${t('tapToScore')}`}
                style={({ pressed }) => [styles.tapCard, p.uid === serverUid && styles.cardLead, isWinner && styles.cardWin, pressed && { opacity: 0.7 }]}
              >
                <View style={styles.cardTop}>
                  <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName} numberOfLines={1}>{isWinner ? '🏆 ' : ''}{p.name}</Text>
                    {p.uid === serverUid ? <Text style={styles.badge}>🏓 {t('serving')}</Text> : null}
                  </View>
                </View>
                <Text style={styles.tapScore} adjustsFontSizeToFit numberOfLines={1}>{scores[p.uid]}</Text>
                <Text style={styles.tapHint}>{t('tapToScore')}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 8 }}>
        {winners.length > 0 ? (
          <View style={styles.winner} accessibilityRole="alert">
            <Text style={styles.winnerText}>🏆 {t('winnerBanner', { name: winners.map((w) => w.name).join(' & ') })}</Text>
            <Text style={styles.winnerSub}>{losers.length > 0 ? t('penaltyLoser', { name: losers.map((l) => l.name).join(' & ') }) : t('keepPlaying')}</Text>
          </View>
        ) : null}

        <View style={styles.roundBar}>
          <Text style={styles.roundTitle}>{t('roundTitle', { n: roundNo })}</Text>
          {dealerName ? <Text style={styles.dealerText}>🃏 {t('dealsNow', { name: dealerName })}</Text> : null}
        </View>

        {game.players.map((p) => {
          const isLeader = leaders.includes(p.uid);
          const isWinner = winnerUids.includes(p.uid);
          const isLoser = loserUids.includes(p.uid);
          const change = lastRound ? lastRound.points[p.uid] ?? 0 : null;
          return (
            <View key={p.uid} style={[styles.card, isLeader && styles.cardLead, isWinner && styles.cardWin]}>
              <View style={styles.cardTop}>
                <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName} numberOfLines={1}>{isWinner ? '🏆 ' : isLoser ? '💥 ' : isLeader ? '👑 ' : ''}{p.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.score} adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`${p.name}: ${scores[p.uid]}`}>{scores[p.uid]}</Text>
                  {change !== null ? <Text style={styles.change}>{sign(change)}</Text> : null}
                </View>
              </View>
            </View>
          );
        })}

        {game.rounds.length > 0 ? (
          <View style={{ gap: 8, marginTop: 4 }}>
            <Text style={styles.sectionLabel}>{t('roundsH')}</Text>
            <RoundsTable players={game.players} rounds={game.rounds} totals={scores} start={game.start} />
          </View>
        ) : (
          <Text style={styles.empty}>{t('noRoundsYet')}</Text>
        )}
      </ScrollView>
      )}

      <View style={styles.bottom}>
        {isTap ? null : <BigButton label={t('addRound')} height={64} onPress={openEntry} />}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <SmallButton label={t('undo')} style={{ flex: 1, minHeight: 56, opacity: game.rounds.length ? 1 : 0.4 }} onPress={() => game.rounds.length && undo()} />
          <BigButton label={saving ? t('working') : t('endGame')} tone="outline" height={56} disabled={saving} style={{ flex: 1 }} onPress={confirmEnd} />
        </View>
      </View>

      <RoundEntry visible={entering} onClose={() => setEntering(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tapCard: { flex: 1, padding: 14, gap: 4, borderRadius: 22, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, justifyContent: 'space-between' },
  tapScore: { textAlign: 'center', fontWeight: '800', fontSize: 100, lineHeight: 112, color: colors.ink },
  tapHint: { textAlign: 'center', fontSize: 16, color: colors.soft },
  bagBox: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  bagTotal: { fontWeight: '800', fontSize: 32, color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { flex: 1, fontWeight: '600', fontSize: 19, color: colors.ink },
  stepBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontWeight: '800', fontSize: 30, lineHeight: 34, color: colors.teal },
  stepValue: { width: 34, textAlign: 'center', fontWeight: '800', fontSize: 28, color: colors.ink },
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  back: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 38, lineHeight: 40, color: colors.teal },
  gameName: { fontWeight: '800', fontSize: 26, color: colors.ink },
  gameSub: { fontSize: 17, color: colors.muted },
  winner: { padding: 14, borderRadius: 16, backgroundColor: '#FFF4CC', borderWidth: 2, borderColor: '#E0B100', gap: 2 },
  winnerText: { fontWeight: '800', fontSize: 24, color: colors.ink },
  winnerSub: { fontSize: 17, color: colors.muted },
  card: { padding: 12, gap: 10, borderRadius: 18, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border },
  cardLead: { borderColor: colors.teal },
  cardWin: { borderColor: '#E0B100', backgroundColor: '#FFFBEA' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  playerName: { flex: 1, fontWeight: '700', fontSize: 23, color: colors.ink },
  score: { minWidth: 96, textAlign: 'right', fontWeight: '800', fontSize: 52, lineHeight: 60, color: colors.ink },
  roundBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  roundTitle: { fontWeight: '800', fontSize: 24, color: colors.ink },
  dealerText: { fontWeight: '700', fontSize: 20, color: colors.primary },
  badge: { fontWeight: '700', fontSize: 16, color: colors.primary },
  change: { fontWeight: '700', fontSize: 20, color: colors.muted },
  sectionLabel: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal },
  empty: { fontSize: 18, color: colors.muted, textAlign: 'center', paddingVertical: 8 },
  help: { fontSize: 17, lineHeight: 23, color: colors.muted },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryName: { flex: 1, fontWeight: '700', fontSize: 21, color: colors.ink },
  entryInput: { width: 130, height: 60, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.input, paddingHorizontal: 12, fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.ink },
  bottom: { gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 50, paddingHorizontal: 16 },
  modalCard: { maxHeight: '92%', gap: 12, padding: 18, borderRadius: 20, backgroundColor: colors.paper },
  modalTitle: { fontWeight: '800', fontSize: 24, color: colors.ink },
  modalInput: { height: 68, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 16, backgroundColor: colors.input, paddingHorizontal: 18, fontSize: 30, fontWeight: '700', color: colors.ink },
});
