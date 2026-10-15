import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, H1, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function Created() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { codeFor } = useFamily();
  const words = codeFor(lang);
  const lines = [words.slice(0, 2), words.slice(2, 4), words.slice(4, 6)].map((w) => w.join(' '));
  const [copied, setCopied] = useState(false);

  const send = () => Share.share({ message: `${t('appName')}\n${words.join(' ')}` }).catch(() => {});
  const copy = async () => {
    await Clipboard.setStringAsync(words.join(' '));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Screen bottom={<BigButton label={t('openApp')} tone="teal" onPress={() => router.replace('/home')} />}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 14, paddingTop: 40, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <H1>{words.length ? t('createdH') : t('working')}</H1>
        <Body>{t('createdSub')}</Body>
        <View style={styles.codeCard} accessible accessibilityLabel={`${t('codeLabel')}: ${words.join(', ')}`}>
          <Text style={styles.codeLabel}>{t('codeLabel')}</Text>
          {lines.map((l, i) => (
            <Text key={i} style={styles.codeLine}>
              {l}
            </Text>
          ))}
        </View>
        <Body style={{ fontSize: 18, lineHeight: 24 }}>{t('codeNote')}</Body>
        <BigButton label={t('sendCode')} onPress={send} />
        <BigButton label={copied ? t('copied') : t('copyCode')} tone="outline" height={64} onPress={() => copy().catch(() => {})} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeCard: { padding: 18, alignItems: 'center', gap: 4, borderRadius: 20, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.inputBorder },
  codeLabel: { fontWeight: '700', fontSize: 16, letterSpacing: 1.3, textTransform: 'uppercase', color: colors.teal, marginBottom: 4 },
  codeLine: { fontWeight: '800', fontSize: 32, lineHeight: 40, color: colors.ink },
});
