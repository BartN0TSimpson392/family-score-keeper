import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInput as TextInputType } from 'react-native';
import { dealerFor, personName, useGame } from '@/data/game';
import { useI18n } from '@/i18n';
import { ErrorText, SmallButton } from '@/ui/components';
import { SideAvatar } from '@/ui/SideAvatar';
import { colors } from '@/ui/theme';

/**
 * The box for adding one round: typed points for each player, or the bag counter for cornhole.
 * Used by the Play screen and by the full-screen scoreboard.
 */
export function RoundEntry({ visible, onClose, focusUid }: { visible: boolean; onClose: () => void; focusUid?: string | null }) {
  const { t } = useI18n();
  const { game, addRound } = useGame();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [bags, setBags] = useState<Record<string, { hole: number; board: number }>>({});
  const [error, setError] = useState('');
  const inputs = useRef<Record<string, TextInputType | null>>({});

  // Every time the box opens it starts empty.
  useEffect(() => {
    if (visible) {
      setTexts({});
      setBags({});
      setError('');
    }
  }, [visible]);

  if (!game) return null;
  const isCorn = game.scorer === 'cornhole' && game.players.length === 2;
  const roundNo = game.rounds.length + 1;
  const dealerName = personName(game, dealerFor(game, game.rounds.length));
  const firstUid = focusUid && game.players.some((p) => p.uid === focusUid) ? focusUid : game.players[0]?.uid;

  const save = () => {
    const points: Record<string, number> = {};
    for (const p of game.players) {
      const raw = (texts[p.uid] ?? '').trim().replace('−', '-');
      if (raw === '') continue;
      if (!/^-?\d{1,6}$/.test(raw)) return setError(t('badPoints'));
      const v = parseInt(raw, 10);
      // Counting down, you type the points someone scored and they come off the score.
      const delta = game.mode === 'down' ? -v : v;
      if (delta !== 0) points[p.uid] = delta;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addRound(points);
    onClose();
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
      return { ...prev, [uid]: { ...cur, [field]: Math.max(0, Math.min(max, cur[field] + d)) } };
    });
  const saveCorn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    addRound(cornScorer ? { [cornScorer.uid]: Math.abs(cornNet) } : {});
    onClose();
  };

  // Modals default to portrait only on iPhone, so say that sideways is fine too.
  const orientations = ['portrait', 'landscape'] as const;

  if (isCorn) {
    return (
      <Modal visible={visible} transparent animationType="fade" supportedOrientations={[...orientations]} onRequestClose={onClose}>
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
              <SmallButton label={t('cancel')} style={{ flex: 1, minHeight: 60, borderColor: colors.inputBorder }} onPress={onClose} />
              <SmallButton label={t('saveRound')} tone="primary" style={{ flex: 1.4, minHeight: 60 }} onPress={saveCorn} />
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" supportedOrientations={[...orientations]} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBack}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{t('roundTitle', { n: roundNo })}</Text>
          {dealerName ? <Text style={styles.dealerText}>🃏 {t('dealsNow', { name: dealerName })}</Text> : null}
          <Text style={styles.help}>{game.mode === 'up' ? t('roundHelpUp') : t('roundHelpDown')}</Text>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
            {game.players.map((p) => (
              <View key={p.uid} style={styles.entryRow}>
                <SideAvatar name={p.name} tint={p.tint} photoUri={p.photoUri} members={p.members} size={44} />
                <Text style={styles.entryName} numberOfLines={1}>{p.name}</Text>
                <TextInput
                  ref={(el) => {
                    inputs.current[p.uid] = el;
                  }}
                  value={texts[p.uid] ?? ''}
                  onChangeText={(v) => {
                    setTexts((prev) => ({ ...prev, [p.uid]: v.replace(/[^0-9\-−]/g, '') }));
                    setError('');
                  }}
                  keyboardType="numbers-and-punctuation"
                  placeholder="0"
                  placeholderTextColor={colors.soft}
                  autoFocus={p.uid === firstUid}
                  selectTextOnFocus
                  style={styles.entryInput}
                  accessibilityLabel={p.name}
                />
              </View>
            ))}
          </ScrollView>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SmallButton label={t('cancel')} style={{ flex: 1, minHeight: 60, borderColor: colors.inputBorder }} onPress={onClose} />
            <SmallButton label={t('saveRound')} tone="primary" style={{ flex: 1.4, minHeight: 60 }} onPress={save} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 24, paddingHorizontal: 16 },
  modalCard: { maxHeight: '96%', gap: 12, padding: 18, borderRadius: 20, backgroundColor: colors.paper, alignSelf: 'center', width: '100%', maxWidth: 560 },
  modalTitle: { fontWeight: '800', fontSize: 24, color: colors.ink },
  dealerText: { fontWeight: '700', fontSize: 20, color: colors.primary },
  help: { fontSize: 17, lineHeight: 23, color: colors.muted },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryName: { flex: 1, fontWeight: '700', fontSize: 21, color: colors.ink },
  entryInput: { width: 130, height: 60, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.input, paddingHorizontal: 12, fontSize: 28, fontWeight: '700', textAlign: 'center', color: colors.ink },
  bagBox: { gap: 8, padding: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  bagTotal: { fontWeight: '800', fontSize: 32, color: colors.ink },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { flex: 1, fontWeight: '600', fontSize: 19, color: colors.ink },
  stepBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, borderColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontWeight: '800', fontSize: 30, lineHeight: 34, color: colors.teal },
  stepValue: { width: 34, textAlign: 'center', fontWeight: '800', fontSize: 28, color: colors.ink },
});
