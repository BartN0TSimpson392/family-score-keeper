import * as Haptics from 'expo-haptics';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { standings, useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, SmallButton } from '@/ui/components';
import { colors } from '@/ui/theme';
import { targetLine } from '@/ui/targetLine';
import { SafeAreaView } from 'react-native-safe-area-context';

const sign = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

export default function Play() {
  const router = useRouter();
  const { t } = useI18n();
  const { game, addPoints, undo, endGame } = useGame();
  const { saveGame } = useFamily();
  const [saving, setSaving] = useState(false);
  const [customFor, setCustomFor] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUid, leaders } = standings(game);
  const winner = game.players.find((p) => p.uid === winnerUid);
  // Count up: the big buttons add. Count down: the big buttons subtract. The small one on the left fixes a slip.
  const steps = game.mode === 'up' ? [1, 5, 10] : [-1, -5, -10];
  const fix = game.mode === 'up' ? -1 : 1;

  const tap = (uid: string, delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addPoints(uid, delta);
  };

  const applyCustom = (direction: 1 | -1) => {
    const amount = parseInt(customText, 10);
    if (customFor && Number.isFinite(amount) && amount > 0) tap(customFor, direction * amount);
    setCustomFor(null);
    setCustomText('');
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
    if (game.log.length === 0) {
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

      <ScrollView contentContainerStyle={{ gap: 12, padding: 16, paddingBottom: 8 }}>
        {winner ? (
          <View style={styles.winner} accessibilityRole="alert">
            <Text style={styles.winnerText}>🏆 {t('winnerBanner', { name: winner.name })}</Text>
            <Text style={styles.winnerSub}>{t('keepPlaying')}</Text>
          </View>
        ) : null}

        {game.players.map((p) => {
          const isLeader = leaders.includes(p.uid);
          return (
            <View key={p.uid} style={[styles.card, isLeader && styles.cardLead, p.uid === winnerUid && styles.cardWin]}>
              <View style={styles.cardTop}>
                <Avatar name={p.name} tint={p.tint} photoUri={p.photoUri} size={52} />
                <Text style={styles.playerName} numberOfLines={1}>{p.uid === winnerUid ? '🏆 ' : isLeader ? '👑 ' : ''}{p.name}</Text>
                <Text style={styles.score} adjustsFontSizeToFit numberOfLines={1} accessibilityLabel={`${p.name}: ${scores[p.uid]}`}>{scores[p.uid]}</Text>
              </View>
              <View style={styles.row}>
                <PointButton label={sign(fix)} small onPress={() => tap(p.uid, fix)} />
                {steps.map((s) => (
                  <PointButton key={s} label={sign(s)} onPress={() => tap(p.uid, s)} />
                ))}
                <PointButton label="…" small onPress={() => { setCustomFor(p.uid); setCustomText(''); }} />
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.bottom}>
        <SmallButton label={t('undo')} style={{ flex: 1, minHeight: 60, opacity: game.log.length ? 1 : 0.4 }} onPress={() => game.log.length && undo()} />
        <BigButton label={saving ? t('working') : t('endGame')} tone="outline" height={60} disabled={saving} style={{ flex: 1 }} onPress={confirmEnd} />
      </View>

      <Modal visible={customFor !== null} transparent animationType="fade" onRequestClose={() => setCustomFor(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('customAmount')}</Text>
            <TextInput
              value={customText}
              onChangeText={(v) => setCustomText(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
              placeholder={t('amountPlaceholder')}
              placeholderTextColor={colors.soft}
              autoFocus
              style={styles.modalInput}
              accessibilityLabel={t('customAmount')}
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <SmallButton label={`− ${t('subtractBtn')}`} style={{ flex: 1, minHeight: 60 }} onPress={() => applyCustom(-1)} />
              <SmallButton label={`+ ${t('addBtn')}`} tone="primary" style={{ flex: 1, minHeight: 60 }} onPress={() => applyCustom(1)} />
            </View>
            <SmallButton label={t('cancel')} style={{ minHeight: 52, borderColor: colors.inputBorder }} onPress={() => setCustomFor(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function PointButton({ label, onPress, small }: { label: string; onPress: () => void; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.pt, small ? styles.ptSmall : styles.ptBig, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.ptText, small && { color: colors.teal }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  row: { flexDirection: 'row', gap: 8 },
  pt: { height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ptBig: { flex: 2, backgroundColor: colors.primary },
  ptSmall: { flex: 1.2, borderWidth: 2, borderColor: colors.teal, backgroundColor: 'transparent' },
  ptText: { fontWeight: '800', fontSize: 24, color: colors.cream },
  bottom: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 90, paddingHorizontal: 20 },
  modalCard: { gap: 14, padding: 18, borderRadius: 20, backgroundColor: colors.paper },
  modalTitle: { fontWeight: '800', fontSize: 24, color: colors.ink },
  modalInput: { height: 68, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 16, backgroundColor: colors.input, paddingHorizontal: 18, fontSize: 30, fontWeight: '700', color: colors.ink },
});
