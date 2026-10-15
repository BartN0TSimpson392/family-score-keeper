import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useFamily } from '@/data/store';
import { useI18n } from '@/i18n';
import { BigButton, Body, ErrorText, H1, Screen, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

/** Big warning before the old family code stops working. */
export default function NewCode() {
  const router = useRouter();
  const { t } = useI18n();
  const { newCode } = useFamily();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  return (
    <Screen
      bottom={
        <View style={{ gap: 12 }}>
          <BigButton
            label={busy ? t('working') : t('yesNew')}
            height={84}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError(false);
              try {
                await newCode();
                router.back();
              } catch (e) {
                console.warn('Could not make a new code', (e as { code?: string })?.code ?? e);
                setError(true);
                setBusy(false);
              }
            }}
          />
          <BigButton label={t('noKeep')} tone="outline" height={76} onPress={() => router.back()} />
        </View>
      }
    >
      <TopBar onBack={() => router.back()} backLabel={t('cancel')} />
      <View style={{ gap: 18 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 46 }}>⚠️</Text>
        </View>
        <H1 style={{ fontSize: 32 }}>{t('newCodeH')}</H1>
        <View style={{ gap: 14 }}>
          <Body style={{ color: colors.ink }}>{t('nc1')}</Body>
          <Body style={{ color: colors.ink }}>{t('nc2')}</Body>
          <Body style={{ color: colors.ink }}>{t('nc3')}</Body>
          {error ? <ErrorText>{t('errorGeneric')}</ErrorText> : null}
        </View>
      </View>
    </Screen>
  );
}
