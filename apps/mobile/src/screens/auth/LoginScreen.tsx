import { emailSchema } from '@repo/shared';
import { translateValidationMessage, type Locale } from '@repo/shared/i18n';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { Mail, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NameForm } from '@/components/auth/NameForm';
import { RegisterFlow } from '@/components/auth/RegisterFlow';
import { Button, EmptyState, IconButton, Input, Text } from '@/components/ui';
import { splitName } from '@/features/auth/account';
import {
  CANCELLED,
  isAppleSignInAvailable,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  updateProfile,
} from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError, errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radius, space } from '@/theme';

type Busy = 'apple' | 'google' | 'password' | 'dev' | null;
type Mode = 'login' | 'register';

/** Erstes Test-Konto aus den Seed-Daten. Das Passwort tippt man selbst ein (steht in der .env). */
const DEV_EMAIL = 'seed-mia@example.com';

function firstIssue(
  error: { issues: { message: string }[] },
  locale: Locale,
  fallback: string,
): string {
  const message = error.issues[0]?.message;
  return message ? translateValidationMessage(message, locale) : fallback;
}

/** Anmeldung per E-Mail/Passwort. Die Registrierung läuft in drei Schritten (`RegisterFlow`). */
export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const a = t.common.auth;
  const { ready, userId, account, accountLoading, accountError, refetchAccount, suggestedName } =
    useAuth();

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [devEmail, setDevEmail] = useState(DEV_EMAIL);
  const [devPassword, setDevPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleName, setAppleName] = useState({ firstName: '', lastName: '' });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const done = userId !== null && account?.profileComplete === true;
  const showApple = env.auth.apple && appleAvailable;
  const showSocialLogin = mode === 'login' && (showApple || env.auth.google);

  useEffect(() => {
    let active = true;
    void isAppleSignInAvailable().then((available) => {
      if (active) setAppleAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!done) return;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [done, router]);

  /** Führt einen Login-Schritt aus und zeigt Fehler auf Deutsch. Abbrüche bleiben still. */
  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setError(null);
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.code === CANCELLED)) {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(null);
    }
  };

  const withApple = () =>
    run('apple', async () => {
      const name = await signInWithApple();
      setAppleName(name);
      // Apple nennt den Namen nur beim ersten Mal. Wenn er da ist, gleich speichern.
      if (name.firstName && name.lastName) {
        await updateProfile(name.firstName, name.lastName).catch(() => undefined);
        await refetchAccount();
      }
    });

  const login = () => {
    const parsedEmail = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsedEmail.success) {
      setError(firstIssue(parsedEmail.error, locale, t.common.checkInput));
      return;
    }
    if (!password) {
      setError(a.passwordMissing);
      return;
    }
    void run('password', () => signInWithPassword(parsedEmail.data, password));
  };

  const devLogin = () => {
    if (!devEmail.trim() || !devPassword) {
      setError(a.devMissing);
      return;
    }
    void run('dev', () => signInWithPassword(devEmail.trim(), devPassword));
  };

  let body;
  if (!ready || done || (userId !== null && accountLoading)) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.strong} />
      </View>
    );
  } else if (userId !== null && !account) {
    body = (
      <EmptyState
        tone="error"
        icon={Mail}
        title={t.common.accountNotLoaded}
        message={errorMessage(accountError)}
        actionLabel={t.common.retry}
        onAction={() => void refetchAccount()}
      />
    );
  } else if (userId !== null && account) {
    const suggestion = splitName(suggestedName);
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {a.nameTitle}
          </Text>
          <Text variant="body" color="secondary">
            {a.nameOptionalIntro}
          </Text>
        </View>
        <NameForm
          initialFirstName={account.firstName || appleName.firstName || suggestion.firstName}
          initialLastName={account.lastName || appleName.lastName || suggestion.lastName}
          submitLabel={t.common.save}
          onSaved={() => undefined}
        />
        <Button label={a.addLater} variant="ghost" onPress={close} />
        <Button label={t.common.signOut} variant="ghost" onPress={() => void signOut()} />
      </View>
    );
  } else if (confirmationSent) {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {a.confirmTitle}
          </Text>
          <Text variant="body" color="secondary">
            {a.confirmText(email)}
          </Text>
        </View>
        <Button
          label={a.toLogin}
          variant="ghost"
          onPress={() => {
            setConfirmationSent(false);
            setMode('login');
            setPassword('');
          }}
        />
      </View>
    );
  } else if (mode === 'register') {
    body = (
      <RegisterFlow
        onSignIn={() => {
          setError(null);
          setMode('login');
        }}
        onConfirmationSent={(registeredEmail) => {
          setEmail(registeredEmail);
          setConfirmationSent(true);
        }}
      />
    );
  } else {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {t.common.signIn}
          </Text>
          <Text variant="body" color="secondary">
            {a.loginIntro}
          </Text>
        </View>

        {showSocialLogin ? (
          <View style={styles.providers}>
            {showApple ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={radius.button}
                style={styles.appleButton}
                onPress={() => void withApple()}
              />
            ) : null}
            {env.auth.google ? (
              <Button
                label={a.google}
                variant="outline"
                size="lg"
                fullWidth
                loading={busy === 'google'}
                disabled={busy !== null && busy !== 'google'}
                onPress={() => void run('google', signInWithGoogle)}
              />
            ) : null}
          </View>
        ) : null}

        {showSocialLogin ? (
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text variant="footnote" color="tertiary">
              {a.orEmail}
            </Text>
            <View style={styles.line} />
          </View>
        ) : null}

        <Input
          label={a.emailLabel}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          placeholder={a.emailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <Input
          label={a.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={login}
        />
        <Button
          label={t.common.signIn}
          size="lg"
          fullWidth
          loading={busy === 'password'}
          disabled={busy !== null && busy !== 'password'}
          onPress={login}
        />
        <Button
          label={a.toRegister}
          variant="ghost"
          onPress={() => {
            setError(null);
            setMode('register');
          }}
        />

        {__DEV__ ? (
          <View style={styles.dev}>
            <Text variant="overline" color="tertiary">
              {a.devOnly}
            </Text>
            <Text variant="footnote" color="secondary">
              {a.devHint}
            </Text>
            <Input
              label={a.devEmail}
              value={devEmail}
              onChangeText={setDevEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label={a.devPassword}
              value={devPassword}
              onChangeText={setDevPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={devLogin}
            />
            <Button
              label={a.devSubmit}
              variant="secondary"
              fullWidth
              loading={busy === 'dev'}
              disabled={busy !== null && busy !== 'dev'}
              onPress={devLogin}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (Platform.OS === 'ios' ? space[4] : insets.top + space[2]) + space[12],
            paddingBottom: insets.bottom + space[8],
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        {body}
        {error ? (
          <Text
            variant="callout"
            align="center"
            accessibilityLiveRegion="polite"
            style={{ color: colors.status.error.text }}
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>
      <IconButton
        icon={X}
        variant="plain"
        accessibilityLabel={t.common.close}
        onPress={close}
        style={[styles.close, { top: Platform.OS === 'ios' ? space[3] : insets.top + space[2] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: { flexGrow: 1, paddingHorizontal: layout.screenPaddingX, gap: space[4] },
  close: { position: 'absolute', right: layout.screenPaddingX - space[2] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: space[16] },
  block: { gap: space[4] },
  intro: { gap: space[2], marginBottom: space[2] },
  providers: { gap: space[3] },
  appleButton: { height: 56, alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginVertical: space[1] },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.strong },
  dev: {
    gap: space[3],
    marginTop: space[6],
    padding: space[4],
    borderRadius: radius.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
  },
});
