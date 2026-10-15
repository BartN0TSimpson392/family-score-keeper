import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { dealerFor, personName, serverFor, standings, useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, ErrorText, SmallButton } from '@/ui/components';
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
  const [bags, setBags] = useState<Record<string, { hole: number; board: number }>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [entryError, setEntryError] = useState('');
  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUids, loserUids, leaders } = standings(game);
  const losers = game.players.filter((p) => loserUids.includes(p.uid));
  const winners = game.players.filter((p) => winnerUids.includes(p.uid));
  const roundNo = game.rounds.length + 1;
  const isTap = game.scorer === 'tap';
  const isCorn = game.scorer === 'cornhole' && game.players.length === 2;
  const serverUid = serverFor(game);

  const tapPoint = (uid: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    addRound({ [uid]: 1 });
  };

  // Cornhole: 3 for a bag in the hole, 1 for a bag on the board. The lower total cancels out and only the difference scores.
  const rawOf = (uid: string) => 3 * (bags[uid]?.hole ?? 0) + (bags[uid]?.board ?? 0);
  const [sideA, sideB] = game.players;
  const cornNet = isCorn ? rawOf(sideA.uid) - rawOf(sideB.uid) : 0;
  const cornScorer = cornNet > 0 ? sideA : cornNet < 0 ? sideB : null;
  const bump = (uid: string, field: 'hole' | 'board', d: number) =>
    setBags((prev) => {
      const cur = prev[uid] ?? { hole: 0, board: 0 };
      const max = game.teams ? 8 : 4;
      const v = Math.max(0, Math.min(max, cur[field] + d));
      return { ...prev, [uid]: { ...cur, [field]: v } };
    });
  const saveCorn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addRound(cornScorer ? { [cornScorer.uid]: Math.abs(cornNet) } : {});
    setEntering(false);
  };
  const dealerUid = dealerFor(game, game.rounds.length);
  const dealerName = personName(game, dealerUid);
  const lastRound = game.rounds[game.rounds.length - 1];

  const openEntry = () => {
    setBags({});
    setTexts({});
    setEntryError('');
    setEntering(true);
  };

  const saveRound = () => {
    const points: Record<string, number> = {};
    for (const p of game.players) {
      const raw = (texts[p.uid] ?? '').trim().replace('−', '-');
      if (raw === '') continue;
      if (!/^-?\d{1,6}$/.test(raw)) return setEntryError(t('badPoints'));
      const v = parseInt(raw, 10);
      // Counting down, you type the points someone scored and they come off the score.
      const delta = game.mode === 'down' ? -v : v;
      if (delta !== 0) points[p.uid] = delta;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addRound(points);
    setEntering(false);
  };

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
        <View style={{ flex: 1, gap: 12, padding: 16 }}>
          {winners.length > 0 ? (
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

      <Modal visible={entering && isCorn} transparent animationType="fade" onRequestClose={() => setEntering(false)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('roundTitle', { n: roundNo })}</Text>
            <Text style={styles.help}>{t('bagsHelp')}</Text>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }}>
              {game.players.map((p) => (
                <View key={p.uid} style={styles.bagBox}>
                  <View style={styles.entryRow}>
                    <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={40} />
                    <Text style={styles.entryName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.bagTotal}>{rawOf(p.uid)}</Text>
                  </View>
                  <Stepper label={`${t('bagsHole')} (3)`} value={bags[p.uid]?.hole ?? 0} onChange={(d) => bump(p.uid, 'hole', d)} />
                  <Stepper label={`${t('bagsBoard')} (1)`} value={bags[p.uid]?.board ?? 0} onChange={(d) => bump(p.uid, 'board', d)} />
                </View>
              ))}
            </ScrollView>
            <Text style={styles.dealerText}>{cornScorer ? t('cornholeNet', { name: cornScorer.name, n: Math.abs(cornNet) }) : t('cornholeTie')}</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SmallButton label={t('cancel')} style={{ flex: 1, minHeight: 60, borderColor: colors.inputBorder }} onPress={() => setEntering(false)} />
              <SmallButton label={t('saveRound')} tone="primary" style={{ flex: 1.4, minHeight: 60 }} onPress={saveCorn} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={entering && !isCorn} transparent animationType="fade" onRequestClose={() => setEntering(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('roundTitle', { n: roundNo })}</Text>
            {dealerName ? <Text style={styles.dealerText}>🃏 {t('dealsNow', { name: dealerName })}</Text> : null}
            <Text style={styles.help}>{game.mode === 'up' ? t('roundHelpUp') : t('roundHelpDown')}</Text>
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              {game.players.map((p, i) => (
                <View key={p.uid} style={styles.entryRow}>
                  <Avatar name={p.name} tint={p.tint} photoUri={p.photoUri} size={44} />
                  <Text style={styles.entryName} numberOfLines={1}>{p.name}</Text>
                  <TextInput
                    value={texts[p.uid] ?? ''}
                    onChangeText={(v) => { setTexts((prev) => ({ ...prev, [p.uid]: v.replace(/[^0-9\-−]/g, '') })); setEntryError(''); }}
                    keyboardType="numbers-and-punctuation"
                    placeholder="0"
                    placeholderTextColor={colors.soft}
                    autoFocus={i === 0}
                    selectTextOnFocus
                    style={styles.entryInput}
                    accessibilityLabel={p.name}
                  />
                </View>
              ))}
            </ScrollView>
            {entryError ? <ErrorText>{entryError}</ErrorText> : null}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SmallButton label={t('cancel')} style={{ flex: 1, minHeight: 60, borderColor: colors.inputBorder }} onPress={() => setEntering(false)} />
              <SmallButton label={t('saveRound')} tone="primary" style={{ flex: 1.4, minHeight: 60 }} onPress={saveRound} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (d: number) => void }) {
  return (
    <View style={styles.stepRow}>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable onPress={() => onChange(-1)} accessibilityRole="button" accessibilityLabel={`${label} −1`} style={styles.stepBtn}>
        <Text style={styles.stepBtnText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={() => onChange(1)} accessibilityRole="button" accessibilityLabel={`${label} +1`} style={[styles.stepBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
        <Text style={[styles.stepBtnText, { color: colors.cream }]}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tapCard: { flex: 1, padding: 14, gap: 4, borderRadius: 22, backgroundColor: colors.card, borderWidth: 3, borderColor: colors.border, justifyContent: 'space-between' },
  tapScore: { textAlign: 'center', fontWeight: '800', fontSize: 120, lineHeight: 130, color: colors.ink },
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
