import * as ScreenOrientation from 'expo-screen-orientation';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider } from '@/data/game';
import { FamilyProvider } from '@/data/store';
import { ensureSignedIn } from '@/firebase';
import { I18nProvider } from '@/i18n';
import { colors } from '@/ui/theme';

function Gate() {
  // Give this phone an anonymous Firebase account. Not awaited: the screens work while it connects.
  useEffect(() => {
    // The whole app stays upright, except the full-screen scoreboard, which turns sideways by itself.
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    ensureSignedIn().catch((e) => console.warn('Firebase sign-in failed', e?.code ?? e));
  }, []);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper }, animation: 'slide_from_right' }}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="home" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="board" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <FamilyProvider>
          <GameProvider>
            <Gate />
          </GameProvider>
        </FamilyProvider>
      </I18nProvider>
    </SafeAreaProvider>
  );
}
