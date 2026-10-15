import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, ErrorText, Field, H1, Screen, TopBar } from '@/ui/components';

export default function Join() {
  const router = useRouter();
  const { t } = useI18n();
  const { checkCode } = useFamily();
  const [code, setCode] = useState('');
  const [bad, setBad] = useState(false);
  const [busy, setBusy] = useState(false);
  const [netError, setNetError] = useState(false);
  const [locked, setLocked] = useState(false);

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setCode(text);
  };

  const next = async () => {
    if (busy) return;
    setBusy(true);
    setNetError(false);
    setLocked(false);
    try {
      if (!(await checkCode(code))) {
        setBad(true);
        return;
      }
      setBad(false);
      router.push({ pathname: '/who', params: { code } });
    } catch (e) {
      console.warn('Could not check the code', (e as { code?: string })?.code ?? e);
      if (String((e as { code?: string })?.code ?? '').includes('resource-exhausted')) setLocked(true);
      else setNetError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottom={<BigButton label={busy ? t('working') : t('next')} disabled={busy} onPress={next} />}>
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
          <H1>{t('joinH')}</H1>
          <Body>{t('joinSub')}</Body>
          <Field
            label={t('fldCode')}
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setBad(false);
            }}
            multiline
            submitBehavior="submit"
            returnKeyType="next"
            onSubmitEditing={next}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {bad ? <ErrorText>{t('badCode')}</ErrorText> : null}
          {locked ? <ErrorText>{t('tooManyTries')}</ErrorText> : null}
          {netError ? <ErrorText>{t('errorGeneric')}</ErrorText> : null}
          <BigButton label={t('paste')} tone="outline" height={64} onPress={() => paste().catch(() => {})} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
