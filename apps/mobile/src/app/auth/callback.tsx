import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { completeSignInFromUrl } from '@/features/auth/api';
import { colors } from '@/theme';

/**
 * Rücksprung nach OAuth oder E-Mail-Bestätigung, falls die URL als Deep Link ankommt.
 * Setzt die Session und geht zurück dorthin, wo der Login gestartet wurde.
 */
export default function AuthCallbackRoute() {
  const router = useRouter();
  const url = Linking.useLinkingURL();

  useEffect(() => {
    let active = true;
    void (async () => {
      if (url) await completeSignInFromUrl(url).catch(() => undefined);
      if (!active) return;
      if (router.canGoBack()) router.back();
      else router.replace('/');
    })();
    return () => {
      active = false;
    };
  }, [router, url]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.default,
      }}
    >
      <ActivityIndicator color={colors.accent.strong} />
    </View>
  );
}
