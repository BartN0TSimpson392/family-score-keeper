import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, ErrorText, Field, H1, Screen, TopBar } from '@/ui/components';
import { PhotoPicker } from '@/ui/PhotoPicker';

export default function Who() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { t } = useI18n();
  const { joinFamily } = useFamily();
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const join = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError(t('needYourName'));
      return;
    }
    if (!photo) {
      setError(t('joinPhotoNeeded'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await joinFamily({ code: code ?? '', userName: name.trim(), photoUri: photo });
      if (ok) router.replace('/waiting');
      else router.back();
    } catch (e) {
      console.warn('Could not join', (e as { code?: string })?.code ?? e);
      setError(t('errorGeneric'));
      setBusy(false);
    }
  };

  return (
    <Screen bottom={<BigButton label={busy ? t('working') : t('joinBtn')} disabled={busy} onPress={join} />}>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <H1>{t('whoH')}</H1>
          <Body>{t('whoSub')}</Body>
          <Field label={t('fldName')} value={name} onChangeText={(v) => { setName(v); setError(''); }} autoCapitalize="words" textContentType="givenName" returnKeyType="done" />
          <PhotoPicker uri={photo} onChange={(u) => { setPhoto(u); setError(''); }} title={t('joinPhotoH')} sub={t('joinPhotoSub')} />
          {error ? <ErrorText>{error}</ErrorText> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
