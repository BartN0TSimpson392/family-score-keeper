import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { gameKeyFor, useGame } from '@/data/game';
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
  const { session, members, games } = useFamily();
  const { startGame, recentNames } = useGame();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<Mode>('up');
  const [targetText, setTargetText] = useState('');
  const [startText, setStartText] = useState('');
  const [goalText, setGoalText] = useState('0');
  const [picked, setPicked] = useState<string[]>([session.uid]);
  const [dealer, setDealer] = useState(false);
  const [firstDealer, setFirstDealer] = useState<string | null>(null);
  const [error, setError] = useState('');

  // You first, then everyone else in the usual order.
  const ordered = useMemo(() => [...members].sort((a, b) => Number(b.id === session.uid) - Number(a.id === session.uid)), [members, session.uid]);

  // Names this phone used before, plus every game the family has saved.
  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of [...recentNames, ...games.map((g) => g.gameName)]) {
      const key = gameKeyFor(n);
      if (!seen.has(key)) {
        seen.add(key);
        out.push(n);
      }
    }
    return out.slice(0, 8);
  }, [recentNames, games]);

  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  // Picking a game played before also fills in the rules it used last time.
  const pickName = (n: string) => {
    setName(n);
    setError('');
    const last = games.find((g) => g.gameKey === gameKeyFor(n));
    if (!last) return;
    setMode(last.mode);
    if (last.mode === 'up') setTargetText(last.target != null ? String(last.target) : '');
    else {
      setStartText(String(last.start));
      setGoalText(String(last.target ?? 0));
    }
  };

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
    const first = players.find((p) => p.uid === firstDealer)?.uid ?? players[0]?.uid ?? null;
    startGame({ name, mode, start, target, players, dealer, firstDealerUid: dealer ? first : null });
    router.replace('/play');
  };

  return (
    <Screen bottom={<BigButton label={t('letsPlay')} onPress={start} />}>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <H1>{t('setupH')}</H1>

          <Field label={t('fldGameName')} value={name} onChangeText={(v) => { setName(v); setError(''); }} placeholder={t('gameNamePlaceholder')} autoCapitalize="words" returnKeyType="done" />
          {suggestions.length > 0 ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.small}>{t('recentGames')}</Text>
              <View style={styles.chips}>
                {suggestions.map((n) => (
                  <Pressable key={n} onPress={() => pickName(n)} style={styles.chip} accessibilityRole="button">
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

          <View style={styles.dealerBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.section}>🃏 {t('trackDealer')}</Text>
                <Body style={{ fontSize: 17, lineHeight: 23 }}>{t('trackDealerSub')}</Body>
              </View>
              <Switch value={dealer} onValueChange={setDealer} accessibilityLabel={t('trackDealer')} trackColor={{ true: colors.teal }} />
            </View>
            {dealer ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.small}>{t('firstDealer')}</Text>
                <View style={styles.chips}>
                  {ordered.filter((m) => picked.includes(m.id)).map((m) => {
                    const on = (firstDealer && picked.includes(firstDealer) ? firstDealer : ordered.find((o) => picked.includes(o.id))?.id) === m.id;
                    return (
                      <Pressable key={m.id} onPress={() => setFirstDealer(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, on && { backgroundColor: colors.teal }]}>
                        <Text style={[styles.chipText, on && { color: colors.cream }]}>{m.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Body style={{ fontSize: 16, lineHeight: 22 }}>{t('dealOrderHelp')}</Body>
              </View>
            ) : null}
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
  dealerBox: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border },
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
