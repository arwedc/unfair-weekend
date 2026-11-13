import {
  emailSchema,
  OFFER_CATEGORIES,
  otpVerifySchema,
  passwordSchema,
  userSignUpSchema,
  type OfferCategory,
} from '@repo/shared';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { KeyRound, Mail, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NameForm } from '@/components/auth/NameForm';
import { PasswordResetForm } from '@/components/auth/PasswordResetForm';
import { Button, Chip, EmptyState, IconButton, Input, Text } from '@/components/ui';
import { cleanEmailCode, firstIssueMessage, splitName } from '@/features/auth/account';
import {
  CANCELLED,
  confirmSignUpWithCode,
  isAppleSignInAvailable,
  resendSignUpConfirmation,
  signInWithApple,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithEmail,
  updateProfile,
} from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { ApiError, errorMessage } from '@/lib/api-error';
import { env } from '@/lib/env';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radius, space } from '@/theme';

type Busy = 'apple' | 'google' | 'password' | 'register' | 'confirm' | 'resend' | 'dev' | null;
type Mode = 'login' | 'register' | 'reset';

/** Fehlercodes von Supabase Auth, wenn es zur E-Mail-Adresse schon ein Konto gibt. */
const USER_EXISTS = new Set(['user_already_exists', 'email_exists']);

/** Erstes Test-Konto aus den Seed-Daten. Das Passwort tippt man selbst ein (steht in der .env). */
const DEV_EMAIL = 'seed-mia@example.com';

/** Anmeldung per E-Mail/Passwort; bei der Registrierung sind Alter und Interessen freiwillig. */
export function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, locale, labels } = useT();
  const a = t.common.auth;
  const { ready, userId, account, accountLoading, accountError, refetchAccount, suggestedName } =
    useAuth();

  const [appleAvailable, setAppleAvailable] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [age, setAge] = useState('');
  const [interests, setInterests] = useState<OfferCategory[]>([]);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [devEmail, setDevEmail] = useState(DEV_EMAIL);
  const [devPassword, setDevPassword] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  /** Fehler erscheinen direkt über dem Knopf, der sie ausgelöst hat (Formular oder Test-Login). */
  const [error, setErrorState] = useState<{ text: string; dev: boolean } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appleName, setAppleName] = useState({ firstName: '', lastName: '' });

  const setError = (text: string | null, dev = false) =>
    setErrorState(text === null ? null : { text, dev });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Beim Zurücksetzen besteht nach dem Code schon eine Session, das Formular bleibt aber offen,
  // bis das neue Passwort gespeichert ist.
  const signedIn = userId !== null && mode !== 'reset';
  const done = signedIn && account?.profileComplete === true;
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
    setNotice(null);
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      if (!(caught instanceof ApiError && caught.code === CANCELLED)) {
        setError(errorMessage(caught), kind === 'dev');
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
      setError(firstIssueMessage(parsedEmail.error, locale, t.common.checkInput));
      return;
    }
    if (!password) {
      setError(a.passwordMissing);
      return;
    }
    void run('password', async () => {
      try {
        await signInWithPassword(parsedEmail.data, password);
      } catch (caught) {
        // Konto gibt es, aber die E-Mail ist noch nicht bestätigt: Code eingeben oder neu anfordern.
        if (caught instanceof ApiError && caught.code === 'email_not_confirmed') {
          setConfirmationSent(true);
        }
        throw caught;
      }
    });
  };

  const continueRegistration = () => {
    const parsedEmail = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsedEmail.success) {
      setError(firstIssueMessage(parsedEmail.error, locale, t.common.checkInput));
      return;
    }
    const parsedPassword = passwordSchema.safeParse(password);
    if (!parsedPassword.success) {
      setError(firstIssueMessage(parsedPassword.error, locale, t.common.checkInput));
      return;
    }
    if (password !== passwordConfirmation) {
      setError(a.passwordMismatch);
      return;
    }
    setError(null);
    setRegisterStep(2);
  };

  const register = () => {
    const parsed = userSignUpSchema.safeParse({
      email: email.trim().toLowerCase(),
      password,
      ...(age.trim() ? { age: Number(age.trim()) } : {}),
      interests,
    });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error, locale, t.common.checkInput));
      return;
    }
    void run('register', async () => {
      try {
        const hasSession = await signUpWithEmail(parsed.data);
        if (!hasSession) setConfirmationSent(true);
      } catch (caught) {
        // Konto gibt es schon: zur Anmeldung, E-Mail und Passwort bleiben stehen.
        if (caught instanceof ApiError && USER_EXISTS.has(caught.code)) {
          setMode('login');
          setRegisterStep(1);
        }
        throw caught;
      }
    });
  };

  const confirmEmail = () => {
    const parsed = otpVerifySchema.safeParse({
      email: email.trim().toLowerCase(),
      token: cleanEmailCode(confirmationCode),
    });
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error, locale, t.common.checkInput));
      return;
    }
    void run('confirm', () => confirmSignUpWithCode(parsed.data.email, parsed.data.token));
  };

  const resendConfirmation = () =>
    run('resend', async () => {
      await resendSignUpConfirmation(email.trim().toLowerCase());
      setNotice(a.codeResent);
    });

  const devLogin = () => {
    if (!devEmail.trim() || !devPassword) {
      setError(a.devMissing, true);
      return;
    }
    void run('dev', () => signInWithPassword(devEmail.trim(), devPassword));
  };

  const toggleInterest = (category: OfferCategory) => {
    setInterests((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  };

  /** Hinweis oder Fehler zum Formular, direkt über dem Hauptknopf (nicht unter dem Test-Login). */
  const feedback = (
    <>
      {notice ? (
        <Text variant="footnote" color="secondary" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {error && !error.dev ? <ErrorText text={error.text} /> : null}
    </>
  );

  let body;
  if (!ready || done || (signedIn && accountLoading)) {
    body = (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent.strong} />
      </View>
    );
  } else if (signedIn && !account) {
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
  } else if (signedIn && account) {
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
  } else if (mode === 'reset') {
    body = (
      <PasswordResetForm
        initialEmail={email.trim()}
        onCancel={() => setMode('login')}
        onDone={() => {
          setPassword('');
          setPasswordConfirmation('');
          setMode('login');
        }}
      />
    );
  } else if (confirmationSent) {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {a.confirmTitle}
          </Text>
          <Text variant="body" color="secondary">
            {a.confirmText(email.trim())}
          </Text>
        </View>
        <Input
          label={a.code}
          icon={KeyRound}
          value={confirmationCode}
          onChangeText={setConfirmationCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={confirmEmail}
        />
        {feedback}
        <Button
          label={a.confirmSubmit}
          size="lg"
          fullWidth
          loading={busy === 'confirm'}
          disabled={busy !== null && busy !== 'confirm'}
          onPress={confirmEmail}
        />
        <Button
          label={a.resendCode}
          variant="ghost"
          loading={busy === 'resend'}
          disabled={busy !== null && busy !== 'resend'}
          onPress={() => void resendConfirmation()}
        />
        <Button
          label={a.toLogin}
          variant="ghost"
          onPress={() => {
            setError(null);
            setNotice(null);
            setConfirmationSent(false);
            setConfirmationCode('');
            setMode('login');
            setRegisterStep(1);
            setPassword('');
          }}
        />
      </View>
    );
  } else {
    body = (
      <View style={styles.block}>
        <View style={styles.intro}>
          <Text variant="title1" accessibilityRole="header">
            {mode === 'register' ? a.registerTitle : t.common.signIn}
          </Text>
          <Text variant="body" color="secondary">
            {mode === 'register'
              ? registerStep === 1
                ? a.registerIntro
                : a.aboutYouIntro
              : a.loginIntro}
          </Text>
        </View>

        {mode === 'register' ? (
          <View style={styles.progress}>
            <View style={styles.progressLabels}>
              <Text variant="footnote" color="secondary">
                {a.stepOf(registerStep, 2)}
              </Text>
              <Text variant="footnote" color="tertiary">
                {registerStep === 1 ? a.stepAccount : a.stepAboutYou}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, registerStep === 2 && styles.progressComplete]} />
              <View
                style={[
                  styles.progressFill,
                  registerStep === 2 ? styles.progressComplete : styles.progressEmpty,
                ]}
              />
            </View>
          </View>
        ) : null}

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

        {mode === 'login' ? (
          <>
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
              label={a.forgotPassword}
              variant="ghost"
              style={styles.forgot}
              disabled={busy !== null}
              onPress={() => {
                setError(null);
                setNotice(null);
                setMode('reset');
              }}
            />
            {feedback}
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
                setRegisterStep(1);
              }}
            />
          </>
        ) : (
          <>
            {registerStep === 1 ? (
              <>
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
                />
                <Input
                  label={a.password}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  hint={a.passwordHint}
                />
                <Input
                  label={a.passwordRepeat}
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={continueRegistration}
                />
                {feedback}
                <Button label={t.common.next} size="lg" fullWidth onPress={continueRegistration} />
                <Button
                  label={a.toSignIn}
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setRegisterStep(1);
                    setMode('login');
                  }}
                />
              </>
            ) : (
              <>
                <View style={styles.interests}>
                  <Input
                    label={a.age}
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    maxLength={3}
                    autoComplete="off"
                  />
                </View>
                <View style={styles.interests}>
                  <Text variant="subhead" color="secondary">
                    {a.interestsQuestion}{' '}
                    <Text variant="footnote" color="tertiary">
                      {a.optional}
                    </Text>
                  </Text>
                  <View style={styles.chips}>
                    {OFFER_CATEGORIES.map((category) => (
                      <Chip
                        key={category}
                        label={labels.offerCategory[category]}
                        selected={interests.includes(category)}
                        onPress={() => toggleInterest(category)}
                      />
                    ))}
                  </View>
                </View>
                {feedback}
                <Button
                  label={a.createAccount}
                  size="lg"
                  fullWidth
                  loading={busy === 'register'}
                  disabled={busy !== null && busy !== 'register'}
                  onPress={register}
                />
                <Button
                  label={t.common.back}
                  variant="ghost"
                  onPress={() => {
                    setError(null);
                    setRegisterStep(1);
                  }}
                />
              </>
            )}
          </>
        )}

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
            {error?.dev ? <ErrorText text={error.text} /> : null}
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

function ErrorText({ text }: { text: string }) {
  return (
    <Text
      variant="callout"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: colors.status.error.text }}
    >
      {text}
    </Text>
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
  forgot: { alignSelf: 'flex-end', marginTop: -space[2] },
  progress: { gap: space[2] },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { flexDirection: 'row', gap: space[1], height: 4 },
  progressFill: { flex: 1, borderRadius: radius.badge, backgroundColor: colors.accent.strong },
  progressEmpty: { backgroundColor: colors.border.strong },
  progressComplete: { backgroundColor: colors.accent.strong },
  appleButton: { height: 56, alignSelf: 'stretch' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space[3], marginVertical: space[1] },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border.strong },
  interests: { gap: space[2] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
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
