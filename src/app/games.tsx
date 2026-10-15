import { Redirect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, H1, Notice, Screen, TopBar } from '@/ui/components';

/** Pick what to play. Premade scorecards (Cornhole, Ping Pong, Yahtzee...) will be listed here too. */
export default function Games() {
  const router = useRouter();
  const { t } = useI18n();
  const { session } = useFamily();
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (session.pending) return <Redirect href="/waiting" />;

  return (
    <Screen>
      <TopBar onBack={() => router.back()} />
      <H1>{t('gamesH')}</H1>
      <View style={{ gap: 16 }}>
        <BigButton label={t('manualTitle')} sub={t('manualSub')} height={110} onPress={() => router.push('/setup')} />
        <Notice>{t('premadeSoon')}</Notice>
      </View>
    </Screen>
  );
}
