import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFamily } from '@/data/store';
import { CATEGORIES, PRESETS, type Category, type Preset } from '@/data/presets';
import { normalize } from '@/data/search';
import { useI18n, type Key } from '@/i18n';
import { BigButton, H1, Screen, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

const CAT_KEY: Record<Category, Key> = { cards: 'catCards', dice: 'catDice', board: 'catBoard', lawn: 'catLawn' };

/** Pick what to play: a popular game with its usual rules filled in, or a custom game. */
export default function Games() {
  const router = useRouter();
  const { t } = useI18n();
  const { session } = useFamily();
  const [query, setQuery] = useState('');
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  const q = normalize(query);
  const shown = (cat: Category) => PRESETS.filter((p) => p.cat === cat && (q === '' || normalize(p.name).includes(q)));
  const nothing = q !== '' && CATEGORIES.every((c) => shown(c).length === 0);

  const rules = (p: Preset) => {
    const target = p.target == null ? t('noTargetUp') : p.mode === 'down' ? t('targetDown', { start: p.start, n: p.target }) : p.penalty ? t('targetPenalty', { n: p.target }) : t('targetUp', { n: p.target });
    const people = p.min === p.max ? t('playersExact', { n: p.min }) : p.max >= 8 && p.min === 1 ? t('playersOne') : t('playersRange', { min: p.min, max: p.max });
    return `${target} · ${people}${p.sides === 'teams' ? ` · ${t('teamsTag')}` : ''}`;
  };

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
        <H1>{t('gamesH')}</H1>
        <BigButton label={t('customGameBtn')} sub={t('customGameSub')} height={96} onPress={() => router.push('/setup')} />

        <Text style={styles.section}>{t('presetsH')}</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('searchGames')}
          placeholderTextColor={colors.soft}
          accessibilityLabel={t('searchGames')}
          autoCorrect={false}
          style={styles.search}
        />
        {nothing ? <Text style={styles.empty}>{t('noMatches')}</Text> : null}

        {CATEGORIES.map((cat) =>
          shown(cat).length === 0 ? null : (
            <View key={cat} style={{ gap: 8 }}>
              <Text style={styles.cat}>{t(CAT_KEY[cat])}</Text>
              {shown(cat).map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/setup', params: { preset: p.id } })}
                  style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.name}>{p.name}</Text>
                  <Text style={styles.rules}>{rules(p)}</Text>
                </Pressable>
              ))}
            </View>
          ),
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '800', fontSize: 24, color: colors.ink, marginTop: 6 },
  search: { height: 56, borderWidth: 2, borderColor: colors.inputBorder, borderRadius: 14, backgroundColor: colors.input, paddingHorizontal: 16, fontSize: 20, color: colors.ink },
  empty: { fontSize: 18, color: colors.muted },
  cat: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal, marginTop: 6 },
  row: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', gap: 2 },
  name: { fontWeight: '800', fontSize: 22, color: colors.ink },
  rules: { fontSize: 16, color: colors.muted },
});
