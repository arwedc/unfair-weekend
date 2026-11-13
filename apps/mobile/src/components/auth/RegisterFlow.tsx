import { userSignUpSchema, type OfferCategory } from '@repo/shared';
import { translateValidationMessage } from '@repo/shared/i18n';
import { Mail } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View, type TextInputInstance } from 'react-native';
import Animated, { FadeInLeft, FadeInRight, ReduceMotion } from 'react-native-reanimated';

import { Button, HighlightTitle, Input, ProgressBar, Text } from '@/components/ui';
import { signUpWithEmail } from '@/features/auth/api';
import {
  authErrorField,
  checkEmailStep,
  checkNameStep,
  previousStep,
  registerProgress,
  type EmailErrors,
  type NameErrors,
  type RegisterStep,
} from '@/features/auth/register-logic';
import { ApiError, errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, duration, space } from '@/theme';

import { InterestPicker } from './InterestPicker';

export interface RegisterFlowProps {
  /** Zurück zur Anmeldung („Du hast schon ein Konto?“). */
  onSignIn: () => void;
  /** Supabase verlangt eine Bestätigung per E-Mail, es gibt noch keine Session. */
  onConfirmationSent: (email: string) => void;
}

/**
 * Registrierung in drei Schritten mit Fortschrittsbalken:
 * 1. Vor- und Nachname, 2. E-Mail und Passwort, 3. Interessen (freiwillig).
 * Erst der letzte Schritt legt das Konto an. Mit Session schließt der LoginScreen von selbst.
 */
export function RegisterFlow({ onSignIn, onConfirmationSent }: RegisterFlowProps) {
  const { t, locale } = useT();
  const a = t.common.auth;

  const [step, setStep] = useState<RegisterStep>('name');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [interests, setInterests] = useState<OfferCategory[]>([]);
  const [nameErrors, setNameErrors] = useState<NameErrors>({});
  const [emailErrors, setEmailErrors] = useState<EmailErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastNameRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const passwordRepeatRef = useRef<TextInputInstance>(null);

  const goTo = (next: RegisterStep, dir: 'forward' | 'back') => {
    setError(null);
    setDirection(dir);
    setStep(next);
  };

  const back = () => {
    const previous = previousStep(step);
    if (previous) goTo(previous, 'back');
  };

  // Android: Die Zurück-Taste geht einen Schritt zurück statt die Anmeldung zu schließen.
  useEffect(() => {
    const previous = previousStep(step);
    if (!previous) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setError(null);
      setDirection('back');
      setStep(previous);
      return true;
    });
    return () => subscription.remove();
  }, [step]);

  const submitName = () => {
    const result = checkNameStep(firstName, lastName, locale);
    if (!result.ok) {
      setNameErrors(result.errors);
      return;
    }
    setNameErrors({});
    goTo('email', 'forward');
  };

  const submitEmail = () => {
    const result = checkEmailStep(email, password, passwordRepeat, locale);
    if (!result.ok) {
      setEmailErrors(result.errors);
      return;
    }
    setEmailErrors({});
    goTo('interests', 'forward');
  };

  const toggleInterest = (category: OfferCategory) => {
    setInterests((current) =>
      current.includes(category)
        ? current.filter((value) => value !== category)
        : [...current, category],
    );
  };

  const createAccount = async () => {
    const name = checkNameStep(firstName, lastName, locale);
    if (!name.ok) {
      setNameErrors(name.errors);
      goTo('name', 'back');
      return;
    }
    const parsed = userSignUpSchema.safeParse({
      email: email.trim().toLowerCase(),
      password,
      interests,
    });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      setError(message ? translateValidationMessage(message, locale) : t.common.checkInput);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const hasSession = await signUpWithEmail(parsed.data, name);
      if (!hasSession) onConfirmationSent(parsed.data.email);
    } catch (caught) {
      const message = errorMessage(caught);
      const field = caught instanceof ApiError ? authErrorField(caught.code) : null;
      if (field) {
        // z. B. „E-Mail schon vergeben“: zurück zum Feld, an dem man es ändern kann.
        setEmailErrors(field === 'email' ? { email: message } : { password: message });
        goTo('email', 'back');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const progress = registerProgress(step);
  const progressLabel = a.stepOf(progress.number, progress.total);
  const stepName = { name: a.stepName, email: a.stepEmail, interests: a.stepInterests }[step];
  const entering = (direction === 'forward' ? FadeInRight : FadeInLeft)
    .duration(duration.base)
    .reduceMotion(ReduceMotion.System);

  let content: ReactNode;
  if (step === 'name') {
    content = (
      <>
        <StepHeader title={a.nameTitle} intro={a.nameIntro} />
        <Input
          label={a.firstName}
          value={firstName}
          onChangeText={setFirstName}
          error={nameErrors.firstName}
          autoFocus
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => lastNameRef.current?.focus()}
        />
        <Input
          ref={lastNameRef}
          label={a.lastName}
          value={lastName}
          onChangeText={setLastName}
          error={nameErrors.lastName}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
          onSubmitEditing={submitName}
        />
        <Button label={t.common.next} size="lg" fullWidth onPress={submitName} />
        <Button label={a.toSignIn} variant="ghost" onPress={onSignIn} />
      </>
    );
  } else if (step === 'email') {
    content = (
      <>
        <StepHeader title={a.emailTitle(firstName.trim())} intro={a.emailIntro} />
        <Input
          label={a.emailLabel}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          error={emailErrors.email}
          placeholder={a.emailPlaceholder}
          autoFocus
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <Input
          ref={passwordRef}
          label={a.password}
          value={password}
          onChangeText={setPassword}
          error={emailErrors.password}
          hint={a.passwordHint}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRepeatRef.current?.focus()}
        />
        <Input
          ref={passwordRepeatRef}
          label={a.passwordRepeat}
          value={passwordRepeat}
          onChangeText={setPasswordRepeat}
          error={emailErrors.passwordRepeat}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={submitEmail}
        />
        <Button label={t.common.next} size="lg" fullWidth onPress={submitEmail} />
        <Button label={t.common.back} variant="ghost" onPress={back} />
      </>
    );
  } else {
    content = (
      <>
        <StepHeader title={a.interestsTitle} intro={a.interestsIntro} />
        <InterestPicker selected={interests} onToggle={toggleInterest} />
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
        <Button
          label={a.createAccount}
          size="lg"
          fullWidth
          loading={busy}
          onPress={() => void createAccount()}
        />
        <Button label={t.common.back} variant="ghost" disabled={busy} onPress={back} />
      </>
    );
  }

  return (
    <View style={styles.flow}>
      <View style={styles.progress}>
        <View style={styles.progressLabels}>
          <Text variant="footnote" color="secondary">
            {progressLabel}
          </Text>
          <Text variant="footnote" color="tertiary">
            {stepName}
          </Text>
        </View>
        <ProgressBar value={progress.value} accessibilityLabel={progressLabel} />
      </View>
      <Animated.View key={step} entering={entering} style={styles.step}>
        {content}
      </Animated.View>
    </View>
  );
}

function StepHeader({ title, intro }: { title: string; intro: string }) {
  return (
    <View style={styles.intro}>
      <HighlightTitle variant="title1">{title}</HighlightTitle>
      <Text variant="body" color="secondary">
        {intro}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flow: { gap: space[6] },
  progress: { gap: space[2] },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { gap: space[4] },
  intro: { gap: space[2], marginBottom: space[2] },
});
