import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { colors } from '@/ui/theme';

type P = { uid: string; name: string };

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

/**
 * Points by round, like the quarter-by-quarter box in a football score summary.
 * One row per round, one column per player, and a Total row at the bottom.
 */
export function RoundsTable({
  players,
  rounds,
  totals,
  start = 0,
  pending,
}: {
  players: P[];
  rounds: { points: Record<string, number> }[];
  /** Each player's current (or final) score. */
  totals: Record<string, number>;
  /** Where everyone started. Shown as its own row when it is not zero. */
  start?: number;
  /** A round being built one player at a time. Shown as a last, dimmer row; players who have not entered yet show a dash. */
  pending?: Record<string, number>;
}) {
  const { t } = useI18n();
  const wide = players.length > 4;
  const colStyle = wide ? { width: 84 } : { flex: 1 };
  const firstCol = { width: 76 };

  const table = (
    <View style={{ minWidth: wide ? 76 + players.length * 84 : undefined }}>
      <View style={[styles.row, styles.head]}>
        <Text style={[styles.cell, styles.headText, firstCol]}>{t('roundShort')}</Text>
        {players.map((p) => (
          <Text key={p.uid} style={[styles.cell, styles.headText, colStyle]} numberOfLines={1}>{p.name}</Text>
        ))}
      </View>
      {start !== 0 ? (
        <View style={styles.row}>
          <Text style={[styles.cell, styles.muted, firstCol]}>{t('startLabel')}</Text>
          {players.map((p) => (
            <Text key={p.uid} style={[styles.cell, styles.muted, colStyle]}>{start}</Text>
          ))}
        </View>
      ) : null}
      {rounds.map((r, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 && styles.zebra]}>
          <Text style={[styles.cell, styles.muted, firstCol]}>{i + 1}</Text>
          {players.map((p) => {
            const v = r.points[p.uid] ?? 0;
            return (
              <Text key={p.uid} style={[styles.cell, colStyle, v === 0 && styles.muted]} accessibilityLabel={`${p.name}, ${t('roundTitle', { n: i + 1 })}: ${v}`}>
                {sign(v)}
              </Text>
            );
          })}
        </View>
      ))}
      {pending && Object.keys(pending).length > 0 ? (
        <View style={[styles.row, styles.zebra]}>
          <Text style={[styles.cell, styles.muted, firstCol]}>{rounds.length + 1}</Text>
          {players.map((p) => (
            <Text key={p.uid} style={[styles.cell, colStyle, styles.muted]}>{p.uid in pending ? sign(pending[p.uid]) : '…'}</Text>
          ))}
        </View>
      ) : null}
      <View style={[styles.row, styles.total]}>
        <Text style={[styles.cell, styles.totalText, firstCol]} numberOfLines={1} adjustsFontSizeToFit>{t('totalLabel')}</Text>
        {players.map((p) => (
          <Text key={p.uid} style={[styles.cell, styles.totalText, colStyle]}>{totals[p.uid] ?? start}</Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.box}>
      {wide ? (
        <ScrollView horizontal showsHorizontalScrollIndicator>
          {table}
        </ScrollView>
      ) : (
        table
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  head: { backgroundColor: colors.tealTint },
  zebra: { backgroundColor: colors.paper },
  total: { borderTopWidth: 2, borderTopColor: colors.ink },
  cell: { paddingHorizontal: 6, paddingVertical: 8, textAlign: 'center', fontSize: 19, fontWeight: '600', color: colors.ink },
  headText: { fontSize: 16, fontWeight: '800', color: colors.teal },
  muted: { color: colors.soft, fontWeight: '500' },
  totalText: { fontWeight: '800', fontSize: 20 },
});
