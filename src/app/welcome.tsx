import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '@/i18n';
import { BigButton, Body, H1, LanguageToggle, Screen } from '@/ui/components';

export default function Welcome() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <Screen
      bottom={
        <View style={{ gap: 18 }}>
          <BigButton label={t('startNew')} sub={t('startNewSub')} height={104} onPress={() => router.push('/start')} />
          <BigButton label={t('joinCode')} sub={t('joinCodeSub')} tone="teal" height={104} onPress={() => router.push('/join')} />
        </View>
      }
    >
      <View style={styles.langRow}>
        <LanguageToggle />
      </View>
      <View style={styles.hero}>
        <Text style={{ fontSize: 96 }}>🏆</Text>
        <H1 style={styles.center}>{t('appName')}</H1>
        <Body style={[styles.center, { fontSize: 22, lineHeight: 30 }]}>{t('tagline')}</Body>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  langRow: { alignItems: 'flex-end', paddingTop: 12 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  center: { textAlign: 'center' },
});
