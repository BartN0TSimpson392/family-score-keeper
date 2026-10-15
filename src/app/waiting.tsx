import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, ErrorText, H1, Screen } from '@/ui/components';
import { PhotoPicker } from '@/ui/PhotoPicker';
import { colors } from '@/ui/theme';

/** Shown to someone who joined with the code and is waiting for an admin to say yes. */
export default function Waiting() {
  const router = useRouter();
  const { t } = useI18n();
  const { session, setMyPhoto, signOut, refreshRequest } = useFamily();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'' | 'waiting' | 'missing' | 'error'>('');
  if (!session.signedIn) return <Redirect href="/welcome" />;
  if (!session.pending) return <Redirect href="/home" />;

  const startOver = () => {
    Alert.alert(t('startOver'), t('startOverSure'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('startOver'),
        style: 'destructive',
        onPress: () => {
          signOut();
          router.dismissAll();
          router.replace('/welcome');
        },
      },
    ]);
  };

  const check = async () => {
    if (checking) return;
    setChecking(true);
    setStatus('');
    try {
      const r = await refreshRequest();
      if (r === 'waiting') setStatus('waiting');
      else if (r === 'missing') setStatus('missing');
    } catch {
      setStatus('error');
    } finally {
      setChecking(false);
    }
  };

  const badge = (bg: string, symbol: string) => (
    <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 44 }}>{symbol}</Text>
    </View>
  );

  if (session.declined) {
    return (
      <Screen bottom={<BigButton label={t('startOver')} onPress={startOver} />}>
        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 40 }}>
          {badge(colors.danger, '✋')}
          <H1>{t('declinedH')}</H1>
          <Body>{t('declinedBody')}</Body>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen
      bottom={
        <View style={{ gap: 10 }}>
          <BigButton label={checking ? t('working') : t('waitingCheck')} disabled={checking} onPress={check} />
          <BigButton label={t('startOver')} tone="outline" height={60} onPress={startOver} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 40 }}>
        {badge(colors.teal, '⏳')}
        <H1>{t('waitingH')}</H1>
        <Body>{t('waitingBody')}</Body>
        {status === 'waiting' ? <Body style={{ color: colors.ink, fontWeight: '700' }}>{t('stillWaiting')}</Body> : null}
        {status === 'missing' ? <ErrorText>{t('requestMissing')}</ErrorText> : null}
        {status === 'error' ? <ErrorText>{t('checkFailed')}</ErrorText> : null}
        {!session.photoUri ? (
          <View style={{ gap: 10 }}>
            <ErrorText>{t('waitingNoPhoto')}</ErrorText>
            <PhotoPicker
              onChange={(uri) => {
                if (busy) return;
                setBusy(true);
                setFailed(false);
                setMyPhoto(uri)
                  .catch(() => setFailed(true))
                  .finally(() => setBusy(false));
              }}
            />
            {busy ? <Body>{t('working')}</Body> : null}
            {failed ? <ErrorText>{t('myPhotoFailed')}</ErrorText> : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
