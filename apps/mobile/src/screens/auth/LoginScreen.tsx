import { otpRequestSchema, otpVerifySchema } from '@repo/shared';
import { translateValidationMessage, type Locale } from '@repo/shared/i18n';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { Mail, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NameForm } from '@/components/auth/NameForm';
import { Button, EmptyState, IconButton, Input, Text } from '@/components/ui';
import { splitName } from '@/features/auth/account';
import {
  CANCELLED,
  isAppleSignInAvailable,
  requestEmailCode,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  updateProfile,
  verifyEmailCode,
} from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError, errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radius, space } from '@/theme';

type Busy = 'apple' | 'google' | 'email' | 'code' | 'dev' | null;

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

/**
 * Anmelden mit Apple, Google oder E-Mail-Code. Danach, falls nötig, Vor- und Nachname.
 * Schließt sich von selbst, sobald das Konto vollständig ist.
 */
export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale } = useT();
  const a = t.common.auth;
  const { ready, userId, account, accountLoading, accountError, refetchAccount, suggestedName } =
    useAuth();

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [step, setStep] = useState<'start' | 'code'>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devEmail, setDevEmail] = useState(DEV_EMAIL);
  const [devPassword, setDevPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [appleName, setAppleName] = useState({ firstName: '', lastName: '' });

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const done = userId !== null && account?.profileComplete === true;
  const showApple = env.auth.apple && appleAvailable;
  const anyMethod = showApple || env.auth.google || env.auth.emailOtp;

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

  const sendCode = () => {
    const parsed = otpRequestSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setError(firstIssue(parsed.error, locale, t.common.checkInput));
      return;
    }
    void run('email', async () => {
      await requestEmailCode(parsed.data.email);
      setEmail(parsed.data.email);
      setCode('');
      setStep('code');
    });
  };

  const checkCode = () => {
    const parsed = otpVerifySchema.safeParse({ email, token: code });
    if (!parsed.success) {
      setError(firstIssue(parsed.error, locale, t.common.checkInput));
      return;
    }
    void run('code', () => verifyEmailCode(parsed.data.email, parsed.data.token));
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
            {a.nameIntro}
          </Text>
        </View>
        <NameForm
          initialFirstName={account.firstName || appleName.firstName || suggestion.firstName}
          initialLastName={account.lastName || appleName.lastName || suggestion.lastName}
          submitLabel={t.common.done}
          onSaved={() => undefined}
        />
        <Button label={t.common.signOut} variant="ghost" onPress={() => void signOut()} />
      </View>
    );
  } else if (step === 'code') {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {a.codeTitle}
          </Text>
          <Text variant="body" color="secondary">
            {a.codeIntro(email)}
          </Text>
        </View>
        <Input
          label={a.codeLabel}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={8}
          autoFocus
          onSubmitEditing={checkCode}
        />
        <Button
          label={t.common.signIn}
          size="lg"
          fullWidth
          loading={busy === 'code'}
          disabled={busy !== null && busy !== 'code'}
          onPress={checkCode}
        />
        <Button
          label={a.resendCode}
          variant="ghost"
          loading={busy === 'email'}
          onPress={sendCode}
        />
        <Button
          label={a.otherEmail}
          variant="ghost"
          onPress={() => {
            setError(null);
            setStep('start');
          }}
        />
      </View>
    );
  } else {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {t.common.signIn}
          </Text>
          <Text variant="body" color="secondary">
            {a.intro}
          </Text>
        </View>

        {!anyMethod && !__DEV__ ? (
          <Text variant="callout" color="secondary">
            {a.notEnabled}
          </Text>
        ) : null}

        {showApple || env.auth.google ? (
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

        {env.auth.emailOtp ? (
          <>
            {showApple || env.auth.google ? (
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
              returnKeyType="send"
              onSubmitEditing={sendCode}
            />
            <Button
              label={a.sendCode}
              size="lg"
              fullWidth
              loading={busy === 'email'}
              disabled={busy !== null && busy !== 'email'}
              onPress={sendCode}
            />
          </>
        ) : null}

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
              label={a.password}
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
