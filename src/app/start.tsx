import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, ErrorText, Field, H1, Notice, Screen, TopBar } from '@/ui/components';
import { PhotoPicker } from '@/ui/PhotoPicker';

export default function Start() {
  const router = useRouter();
  const { t } = useI18n();
  const { createFamily } = useFamily();
  const [family, setFamily] = useState('');
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState<string | undefined>();
  const nameRef = useRef<TextInput>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (busy) return;
    if (!name.trim()) {
      setError(t('needYourName'));
      return;
    }
    if (!photo) {
      setError(t('needPhoto'));
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createFamily({ familyName: family.trim() || t('familyDefault'), userName: name.trim(), photoUri: photo });
      router.replace('/created');
    } catch (e) {
      console.warn('Could not create the family', (e as { code?: string })?.code ?? e);
      setError(t('errorGeneric'));
      setBusy(false);
    }
  };

  return (
    <Screen bottom={<BigButton label={busy ? t('working') : t('createBtn')} disabled={busy} onPress={create} />}>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <H1>{t('startH')}</H1>
          <Body>{t('startSub')}</Body>
          <Field label={t('fldFamily')} value={family} onChangeText={setFamily} placeholder={t('familyDefault')} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => nameRef.current?.focus()} />
          <Field label={t('fldName')} value={name} ref={nameRef} returnKeyType="done" onChangeText={(v) => { setName(v); setError(''); }} autoCapitalize="words" textContentType="givenName" />
          <PhotoPicker uri={photo} onChange={(u) => { setPhoto(u); setError(''); }} title={t('selfieH')} sub={t('selfieSub')} />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Notice>{t('adminNote')}</Notice>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
