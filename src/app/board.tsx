import { useKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { standings, useGame } from '@/data/game';
import { useI18n } from '@/i18n';
import { Avatar } from '@/ui/components';
import { targetLine } from '@/ui/targetLine';

const GAP = 12;

/** Full-screen scoreboard for the whole room. Turns sideways, keeps the screen on, and is read-only. */
export default function Board() {
  const router = useRouter();
  const { t } = useI18n();
  const { game } = useGame();
  const [box, setBox] = useState({ w: 0, h: 0 });
  useKeepAwake();

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  if (!game) return <Redirect href="/home" />;

  const { scores, winnerUid, leaders } = standings(game);
  const n = game.players.length;
  const rows = n <= 4 ? 1 : 2;
  const cols = Math.ceil(n / rows);
  const cardW = Math.max(0, (box.w - (cols - 1) * GAP) / cols);
  const cardH = Math.max(0, (box.h - (rows - 1) * GAP) / rows);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{game.gameName}</Text>
        <Text style={styles.sub}>{targetLine(game, t)}</Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('close')} style={styles.close} hitSlop={10}>
          <Text style={styles.closeText}>✕ {t('close')}</Text>
        </Pressable>
      </View>

      <View style={styles.area} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {box.w > 0
          ? game.players.map((p) => {
              const isWin = p.uid === winnerUid;
              const isLead = leaders.includes(p.uid);
              return (
                <View key={p.uid} style={[styles.card, { width: cardW, height: cardH }, isLead && styles.lead, isWin && styles.win]}>
                  <View style={styles.who}>
                    <Avatar name={p.name} tint={p.tint} photoUri={p.photoUri} size={Math.min(64, Math.max(32, cardH * 0.2))} />
                    <Text style={[styles.name, { fontSize: Math.min(34, Math.max(18, cardH * 0.11)) }]} numberOfLines={1}>
                      {isWin ? '🏆 ' : isLead ? '👑 ' : ''}{p.name}
                    </Text>
                  </View>
                  <Text
                    style={[styles.score, { fontSize: Math.max(40, Math.min(cardH * 0.55, cardW * 0.5)) }]}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 8 },
  title: { flexShrink: 1, fontWeight: '800', fontSize: 28, color: '#FFFFFF' },
  sub: { flex: 1, fontSize: 20, color: '#AEB8D0' },
  close: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 2, borderColor: '#AEB8D0', justifyContent: 'center' },
  closeText: { fontWeight: '700', fontSize: 18, color: '#FFFFFF' },
  area: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: GAP, paddingHorizontal: 20, paddingBottom: 14 },
  card: { borderRadius: 24, backgroundColor: '#1B2440', borderWidth: 4, borderColor: '#1B2440', paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'space-between' },
  lead: { borderColor: '#5BD1B0' },
  win: { borderColor: '#F2C94C', backgroundColor: '#2B2A18' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { flex: 1, fontWeight: '700', color: '#FFFFFF' },
  score: { textAlign: 'center', fontWeight: '800', color: '#FFFFFF' },
});
