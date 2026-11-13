import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { NameForm } from '@/components/auth/NameForm';
import { EmptyState, Text } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';
import { UserRound } from 'lucide-react-native';

/** Vor- und Nachname ändern (aus dem Profil heraus). */
export function NameScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const { t } = useT();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/profil'));

  if (!account) {
    return (
      <EmptyState
        icon={UserRound}
        title={t.common.auth.pleaseSignIn}
        message={t.common.auth.nameNeedsSignIn}
        actionLabel={t.common.signIn}
        onAction={() => router.replace('/anmelden')}
      />
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <Text variant="body" color="secondary">
        {t.common.auth.nameIntro}
      </Text>
      <NameForm
        initialFirstName={account.firstName}
        initialLastName={account.lastName}
        submitLabel={t.common.save}
        onSaved={close}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[4], gap: space[5] },
});
