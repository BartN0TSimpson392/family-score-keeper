import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { gameKeyFor, useGame } from '@/data/game';
import { presetById, presetByName } from '@/data/presets';
import { useFamily } from '@/data/store';
import type { Mode } from '@/data/types';
import { useI18n } from '@/i18n';
import { Avatar, BigButton, Body, ErrorText, Field, H1, Screen, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

const MAX_PLAYERS = 8;
const MAX_TEAMS = 4;
const TEAM_COLORS = ['#D9531E', '#1F6F5C', '#6B4FBB', '#B07A00'];

/** "Bartek", "Bartek & Stacey", "Bartek, Stacey & Ola". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/** Set up a custom game: its name, count up or down, an optional target, and who is playing. */
export default function Setup() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, members, games } = useFamily();
  const { startGame, recentNames, rulesFor } = useGame();
  // Coming from the game list: start with that game's usual rules.
  const { preset: presetId } = useLocalSearchParams<{ preset?: string }>();
  const preset = presetById(presetId);
  const [name, setName] = useState(preset?.name ?? '');
  const [mode, setMode] = useState<Mode>(preset?.mode ?? 'up');
  const [targetText, setTargetText] = useState(preset && preset.mode === 'up' && preset.target != null ? String(preset.target) : '');
  const [startText, setStartText] = useState(preset && preset.mode === 'down' ? String(preset.start) : '');
  const [goalText, setGoalText] = useState(preset && preset.mode === 'down' ? String(preset.target ?? 0) : '0');
  const [picked, setPicked] = useState<string[]>([session.uid]);
  const [teamMode, setTeamMode] = useState(preset?.sides === 'teams');
  /** Person id to team number (1 to 4). Anyone missing is not playing. */
  const [teamOf, setTeamOf] = useState<Record<string, number>>({});
  const [teamNames, setTeamNames] = useState<Record<number, string>>({});
  const [winByTwo, setWinByTwo] = useState((preset?.winBy ?? 1) > 1);
  const [firstServer, setFirstServer] = useState<string | null>(null);
  const [penalty, setPenalty] = useState(!!preset?.penalty);
  const [dealer, setDealer] = useState(!!preset?.dealer);
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
    // What this phone used last time wins; otherwise what the family saved last.
    const saved = games.find((g) => g.gameKey === gameKeyFor(n));
    const pr = presetByName(n);
    const r =
      rulesFor(n) ??
      (saved
        ? { mode: saved.mode, start: saved.start, target: saved.target, dealer: false, penalty: !!saved.penalty, winBy: saved.winBy }
        : pr
          ? { mode: pr.mode, start: pr.start, target: pr.target, dealer: pr.dealer, penalty: !!pr.penalty, teams: pr.sides === 'teams', winBy: pr.winBy }
          : undefined);
    if (!r) return;
    setMode(r.mode);
    if (r.mode === 'up') {
      setTargetText(r.target != null ? String(r.target) : '');
    } else {
      setStartText(String(r.start));
      setGoalText(String(r.target ?? 0));
    }
    setDealer(r.dealer);
    setPenalty(!!r.penalty);
    setWinByTwo((r.winBy ?? 1) > 1);
    setTeamMode(!!r.teams);
  };

  const toggle = (id: string) => {
    setError('');
    if (picked.includes(id)) setPicked(picked.filter((x) => x !== id));
    else if (picked.length >= MAX_PLAYERS) setError(t('tooManyPlayers'));
    else setPicked([...picked, id]);
  };

  // Each tap moves a person to the next team, and after the last team they drop out.
  const cycleTeam = (id: string) => {
    setError('');
    const cur = teamOf[id] ?? 0;
    if (cur === 0 && Object.keys(teamOf).length >= MAX_PLAYERS) return setError(t('tooManyPlayers'));
    const next = cur >= MAX_TEAMS ? 0 : cur + 1;
    const copy = { ...teamOf };
    if (next === 0) delete copy[id];
    else copy[id] = next;
    setTeamOf(copy);
  };

  const teamNumbers = [1, 2, 3, 4].filter((n) => ordered.some((m) => teamOf[m.id] === n));
  const playing = teamMode ? ordered.filter((m) => teamOf[m.id]) : ordered.filter((m) => picked.includes(m.id));
  // A few well-known games have their own scoring screen, chosen by the game's name.
  const named = presetByName(name);
  const scorer = named?.scorer;
  const serve = !!named?.serve;
  const firstServerId = playing.find((m) => m.id === firstServer)?.id ?? playing[0]?.id;
  const firstDealerId = playing.find((m) => m.id === firstDealer)?.id ?? playing[0]?.id;

  const start = () => {
    if (!name.trim()) return setError(t('needGameName'));
    if (!teamMode && picked.length < 1) return setError(t('needPlayers'));
    if (teamMode && teamNumbers.length < 2) return setError(t('needTwoTeams'));
    if (scorer === 'cornhole' && (teamMode ? teamNumbers.length : picked.length) !== 2) return setError(t('cornholeTwoSides'));
    let start = 0;
    let target: number | null = null;
    if (mode === 'up') {
      const raw = targetText.trim();
      if (raw !== '') {
        if (!/^\d{1,6}$/.test(raw) || parseInt(raw, 10) <= 0) return setError(t('badTarget'));
        target = parseInt(raw, 10);
      } else if (penalty) {
        return setError(t('needTargetPenalty'));
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
    const person = (m: (typeof ordered)[number]) => ({ uid: m.id, name: m.name, tint: m.tint, photoUri: m.photoUri });
    let players: { uid: string; name: string; tint: string; photoUri?: string; members?: ReturnType<typeof person>[] }[];
    let seats: string[] | undefined;
    if (teamMode) {
      const groups = teamNumbers.map((n) => ordered.filter((m) => teamOf[m.id] === n).map(person));
      players = teamNumbers.map((n, i) => ({
        uid: `team-${n}`,
        name: teamNames[n]?.trim() || joinNames(groups[i].map((m) => m.name)),
        tint: groups[i][0].tint,
        members: groups[i],
      }));
      // Teams sit alternately, so the dealer moves from one team to the other.
      seats = [];
      for (let k = 0; seats.length < groups.reduce((a, g) => a + g.length, 0); k++) for (const g of groups) if (g[k]) seats.push(g[k].uid);
    } else {
      players = playing.map(person);
    }
    const first = firstDealerId ?? null;
    // The serve belongs to a side: the person's own, or the team they are on.
    const serverSide = players.find((p) => p.uid === firstServerId || p.members?.some((m) => m.uid === firstServerId))?.uid ?? null;
    startGame({
      name,
      mode,
      start,
      target,
      players,
      dealer,
      firstDealerUid: dealer ? first : null,
      penalty: mode === 'up' && penalty,
      teams: teamMode,
      seats,
      winBy: mode === 'up' && winByTwo ? 2 : undefined,
      scorer,
      serve,
      firstServerUid: serve ? serverSide : null,
    });
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
          <Body style={{ fontSize: 17, lineHeight: 23 }}>{mode === 'up' ? (penalty ? t('targetHelpPenalty') : t('targetHelpUp')) : t('targetHelpDown')}</Body>
          {mode === 'up' && !penalty ? (
            <View style={styles.dealerBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.section}>{t('winByTwo')}</Text>
                  <Body style={{ fontSize: 17, lineHeight: 23 }}>{t('winByTwoSub')}</Body>
                </View>
                <Switch value={winByTwo} onValueChange={setWinByTwo} accessibilityLabel={t('winByTwo')} trackColor={{ true: colors.teal }} />
              </View>
            </View>
          ) : null}
          {mode === 'up' && !winByTwo ? (
            <View style={styles.dealerBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.section}>{t('penaltyGame')}</Text>
                  <Body style={{ fontSize: 17, lineHeight: 23 }}>{t('penaltyGameSub')}</Body>
                </View>
                <Switch value={penalty} onValueChange={setPenalty} accessibilityLabel={t('penaltyGame')} trackColor={{ true: colors.teal }} />
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <ModeButton label={t('sideSolo')} sub={t('sideSoloSub')} active={!teamMode} onPress={() => setTeamMode(false)} />
            <ModeButton label={t('sideTeams')} sub={t('sideTeamsSub')} active={teamMode} onPress={() => setTeamMode(true)} />
          </View>

          <View style={{ gap: 4 }}>
            <Text style={styles.section}>{teamMode ? t('teamsH') : t('playersH')}</Text>
            <Body style={{ fontSize: 17, lineHeight: 23 }}>{teamMode ? t('teamsHelp') : t('playersHelp')}</Body>
          </View>
          <View style={{ gap: 8 }}>
            {ordered.map((m) => {
              const team = teamOf[m.id] ?? 0;
              const on = teamMode ? team > 0 : picked.includes(m.id);
              const color = teamMode && team > 0 ? TEAM_COLORS[team - 1] : colors.teal;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => (teamMode ? cycleTeam(m.id) : toggle(m.id))}
                  accessibilityRole={teamMode ? 'button' : 'checkbox'}
                  accessibilityState={teamMode ? undefined : { checked: on }}
                  accessibilityLabel={teamMode ? `${m.name}, ${team > 0 ? t('teamN', { n: team }) : t('notOnTeam')}` : undefined}
                  style={[styles.player, on && { borderColor: color, backgroundColor: teamMode ? colors.card : colors.tealTint }]}
                >
                  <Avatar name={m.name} tint={m.tint} photoUri={m.photoUri} size={48} />
                  <Text style={styles.playerName}>{m.name}</Text>
                  {teamMode ? (
                    <View style={[styles.teamBadge, team > 0 && { backgroundColor: color, borderColor: color }]}>
                      <Text style={[styles.teamBadgeText, team > 0 && { color: colors.cream }]}>{team > 0 ? t('teamN', { n: team }) : '—'}</Text>
                    </View>
                  ) : (
                    <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {teamMode && teamNumbers.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.small}>{t('teamNamesH')}</Text>
              {teamNumbers.map((n) => (
                <Field
                  key={n}
                  label={t('teamN', { n })}
                  value={teamNames[n] ?? ''}
                  onChangeText={(v) => setTeamNames({ ...teamNames, [n]: v })}
                  placeholder={joinNames(ordered.filter((m) => teamOf[m.id] === n).map((m) => m.name)) || t('teamNamePlaceholder')}
                  autoCapitalize="words"
                />
              ))}
            </View>
          ) : null}

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
                  {playing.map((m) => {
                    const on = firstDealerId === m.id;
                    return (
                      <Pressable key={m.id} onPress={() => setFirstDealer(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, on && { backgroundColor: colors.teal }]}>
                        <Text style={[styles.chipText, on && { color: colors.cream }]}>{m.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Body style={{ fontSize: 16, lineHeight: 22 }}>{teamMode ? t('seatsHelp') : t('dealOrderHelp')}</Body>
              </View>
            ) : null}
          </View>
          {serve ? (
            <View style={styles.dealerBox}>
              <Text style={styles.section}>🏓 {t('firstServer')}</Text>
              <View style={styles.chips}>
                {playing.map((m) => {
                  const on = firstServerId === m.id;
                  return (
                    <Pressable key={m.id} onPress={() => setFirstServer(m.id)} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.chip, on && { backgroundColor: colors.teal }]}>
                      <Text style={[styles.chipText, on && { color: colors.cream }]}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Body style={{ fontSize: 16, lineHeight: 22 }}>{t('serveHelp')}</Body>
            </View>
          ) : null}
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
  teamBadge: { minWidth: 92, minHeight: 40, paddingHorizontal: 10, borderRadius: 20, borderWidth: 2.5, borderColor: colors.inputBorder, alignItems: 'center', justifyContent: 'center' },
  teamBadgeText: { fontWeight: '800', fontSize: 17, color: colors.muted },
  checkMark: { color: colors.cream, fontWeight: '800', fontSize: 20 },
});
