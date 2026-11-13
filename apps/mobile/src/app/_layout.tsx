import { BottomSheetModalProvider } from '@expo/ui/community/bottom-sheet';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { OfferFiltersProvider } from '@/features/offers/filters-context';
import { hideDevToolsButton } from '@/lib/dev-tools';
import { queryClient } from '@/lib/query-client';
import { colors } from '@/theme';

// Splash bleibt sichtbar, bis die Schrift geladen ist (sonst springt der Text).
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Das blaue Zahnrad von Expo (Tools-Button) verdeckt sonst oben die Stadt und die Suche.
  useEffect(() => {
    hideDevToolsButton();
  }, []);

  // Kommt die App in den Vordergrund, lädt TanStack Query veraltete Daten neu (z. B. freie Plätze).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      focusManager.setFocused(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background.default }}>
      <QueryClientProvider client={queryClient}>
        <OfferFiltersProvider>
          <BottomSheetModalProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: colors.background.default },
                headerTintColor: colors.text.primary,
                headerBackButtonDisplayMode: 'minimal',
                headerShadowVisible: false,
                headerStyle: { backgroundColor: colors.background.default },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="angebot/[id]" options={{ headerShown: false }} />
              <Stack.Screen name="standort/[id]" options={{ title: '' }} />
            </Stack>
          </BottomSheetModalProvider>
        </OfferFiltersProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
