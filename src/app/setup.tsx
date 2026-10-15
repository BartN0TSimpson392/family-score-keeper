import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useGame } from '@/data/game';
import { useFamily } from '@/data/store';
import type { Mode } from '@/data/types';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, Body, ErrorText, Field, H1, Screen, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

const MAX_PLAYERS = 8;

/** Set up a custom game: its name, count up or down, an optional target, and who is playing. */
export default function Setup() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, members } = useFamily();
  const { startGame, recentNames } = useGame();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('up');
  const [targetText, setTargetText] = useState('');
  const [startText, setStartText] = useState('');
  const [goalText, setGoalText] = useState('0');
  const [picked, setPicked] = useState<string[]>([session.uid]);
  const [error, setError] = useState('');

  // You first, then everyone else in the usual order.
  const ordered = useMemo(() => [...members].sort((a, b) => Number(b.id === session.uid) - Number(a.id === session.uid)), [members, session.uid]);

  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const toggle = (id: string) => {
    setError('');
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
    else if (picked.length >= MAX_PLAYERS) setError(t('tooManyPlayers'));
    else setPicked([...picked, id]);
  };

  const start = () => {
    if (!name.trim()) return setError(t('needGameName'));
    if (picked.length < 1) return setError(t('needPlayers'));
    let start = 0;
    let target: number | null = null;
    if (mode === 'up') {
      const raw = targetText.trim();
      if (raw !== '') {
        if (!/^\d{1,6}$/.test(raw) || parseInt(raw, 10) <= 0) return setError(t('badTarget'));
        target = parseInt(raw, 10);
      }
    } else {
      const rawStart = startText.trim();
      if (rawStart === '') return setError(t('needStart'));
      if (!/^\d{1,6}$/.test(rawStart) || parseInt(rawStart, 10) <= 0) return setError(t('badStart'));
      start = parseInt(rawStart, 10);
      const rawGoal = goalText.trim() === '' ? '0' : goalText.trim();
      if (!/^\d{1,6}$/.test(rawGoal) || parseInt(rawGoal, 10) >= start) return setError(t('badGoal'));
      target = parseInt(rawGoal, 10);
    }
    const players = ordered.filter((m) => picked.includes(m.id)).map((m) => ({ uid: m.id, name: m.name, tint: m.tint, photoUri: m.photoUri }));
    startGame({ name, mode, start, target, players });
    router.replace('/play');
  };

  return (
    <Screen bottom={<BigButton label={t('letsPlay')} onPress={start} />}>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <H1>{t('setupH')}</H1>

          <Field label={t('fldGameName')} value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder={t('gameNamePlaceholder')} autoCapitalize="words" returnKeyType="done" />
          {recentNames.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.small}>{t('recentGames')}</Text>
              <View style={styles.chips}>
                {recentNames.slice(0, 8).map((n) => (
                  <Pressable key={n} onPress={() => { setName(n); setError(''); }} style={styles.chip} accessibilityRole="button">
                    <Text style={styles.chipText}>{n}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ModeButton label={t('countUp')} sub={t('countUpSub')} active={mode === 'up'} onPress={() => setMode('up')} />
            <ModeButton label={t('countDown')} sub={t('countDownSub')} active={mode === 'down'} onPress={() => setMode('down')} />
          </View>

          {mode === 'up' ? (
            <Field label={t('fldTarget')} value={targetText} onChangeText={(v) => { setTargetText(v.replace(/[^0-9]/g, '')); setError(''); }} keyboardType="number-pad" placeholder="100" />
          ) : (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Field label={t('fldStart')} value={startText} onChangeText={(v) => { setStartText(v.replace(/[^0-9]/g, '')); setError(''); }} keyboardType="number-pad" placeholder="501" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label={t('fldGoal')} value={goalText} onChangeText={(v) => { setGoalText(v.replace(/[^0-9]/g, '')); setError(''); }} keyboardType="number-pad" placeholder="0" />
              </View>
            </View>
          )}
          <Body style={{ fontSize: 17, lineHeight: 23 }}>{mode === 'up' ? t('targetHelpUp') : t('targetHelpDown')}</Body>

          <View style={{ gap: 4 }}>
            <Text style={styles.section}>{t('playersH')}</Text>
            <Body style={{ fontSize: 17, lineHeight: 23 }}>{t('playersHelp')}</Body>
          </View>
          <View style={{ gap: 8 }}>
            {ordered.map((m) => {
              const on = picked.includes(m.id);
              return (
                <Pressable key={m.id} onPress={() => toggle(m.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[styles.player, on && styles.playerOn]}>
                  <Avatar name={m.name} tint={m.tint} photoUri={m.photoUri} size={48} />
                  <Text style={styles.playerName}>{m.name}</Text>
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                </Pressable>
              );
            })}
          </View>
          {error ? <ErrorText>{error}</ErrorText> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function ModeButton({ label, sub, active, onPress }: { label: string; sub: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: active }} style={[styles.mode, active && styles.modeOn]}>
      <Text style={[styles.modeLabel, active && { color: colors.cream }]}>{label}</Text>
      <Text style={[styles.modeSub, active && { color: '#DCEEE8' }]}>{sub}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  small: { fontWeight: '700', fontSize: 16, color: colors.muted },
  section: { fontWeight: '800', fontSize: 22, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: 2, borderColor: colors.teal, justifyContent: 'center' },
  chipText: { fontWeight: '700', fontSize: 18, color: colors.teal },
  mode: { flex: 1, minHeight: 84, borderRadius: 18, borderWidth: 2.5, borderColor: colors.teal, padding: 12, justifyContent: 'center', gap: 2 },
  modeOn: { backgroundColor: colors.teal },
  modeLabel: { fontWeight: '800', fontSize: 21, color: colors.teal },
  modeSub: { fontSize: 16, color: colors.muted },
  player: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border },
  playerOn: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  playerName: { flex: 1, fontWeight: '700', fontSize: 22, color: colors.ink },
  check: { width: 34, height: 34, borderRadius: 17, borderWidth: 2.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  checkMark: { color: colors.cream, fontWeight: '800', fontSize: 20 },
});
