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
  checkPasswordStep,
  checkPersonStep,
  previousStep,
  registerProgress,
  type PasswordErrors,
  type PersonErrors,
  type RegisterStep,
} from '@/features/auth/register-logic';
import { ApiError, errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, duration, space } from '@/theme';

import { InterestPicker } from './InterestPicker';
import { PasswordRules } from './PasswordRules';

export interface RegisterFlowProps {
  /** Zurück zur Anmeldung („Du hast schon ein Konto?“). */
  onSignIn: () => void;
  /** Supabase verlangt eine Bestätigung per E-Mail, es gibt noch keine Session. */
  onConfirmationSent: (email: string) => void;
}

/**
 * Registrierung in drei Schritten mit Fortschrittsbalken:
 * 1. Vor- und Nachname und E-Mail, 2. Passwort (zweimal, mit Regeln), 3. Interessen (freiwillig).
 * Erst der letzte Schritt legt das Konto an. Mit Session schließt der LoginScreen von selbst.
 */
export function RegisterFlow({ onSignIn, onConfirmationSent }: RegisterFlowProps) {
  const { t, locale } = useT();
  const a = t.common.auth;

  const [step, setStep] = useState<RegisterStep>('person');
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [interests, setInterests] = useState<OfferCategory[]>([]);
  const [personErrors, setPersonErrors] = useState<PersonErrors>({});
  const [passwordErrors, setPasswordErrors] = useState<PasswordErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lastNameRef = useRef<TextInputInstance>(null);
  const emailRef = useRef<TextInputInstance>(null);
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

  const submitPerson = () => {
    const result = checkPersonStep(firstName, lastName, email, locale);
    if (!result.ok) {
      setPersonErrors(result.errors);
      return;
    }
    setPersonErrors({});
    goTo('password', 'forward');
  };

  const submitPassword = () => {
    const result = checkPasswordStep(password, passwordRepeat, locale);
    if (!result.ok) {
      setPasswordErrors(result.errors);
      return;
    }
    setPasswordErrors({});
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
    // Sicherheitshalber alles nochmal prüfen und bei Bedarf zum passenden Schritt springen.
    const person = checkPersonStep(firstName, lastName, email, locale);
    if (!person.ok) {
      setPersonErrors(person.errors);
      goTo('person', 'back');
      return;
    }
    const passwordCheck = checkPasswordStep(password, passwordRepeat, locale);
    if (!passwordCheck.ok) {
      setPasswordErrors(passwordCheck.errors);
      goTo('password', 'back');
      return;
    }
    const parsed = userSignUpSchema.safeParse({ email: person.email, password, interests });
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message;
      setError(message ? translateValidationMessage(message, locale) : t.common.checkInput);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const hasSession = await signUpWithEmail(parsed.data, person);
      if (!hasSession) onConfirmationSent(parsed.data.email);
    } catch (caught) {
      const message = errorMessage(caught);
      const field = caught instanceof ApiError ? authErrorField(caught.code) : null;
      // z. B. „E-Mail schon vergeben“: zurück zum Schritt, in dem man es ändern kann.
      if (field === 'email') {
        setPersonErrors({ email: message });
        goTo('person', 'back');
      } else if (field === 'password') {
        setPasswordErrors({ password: message });
        goTo('password', 'back');
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const progress = registerProgress(step);
  const progressLabel = a.stepOf(progress.number, progress.total);
  const stepLabel = {
    person: a.stepPerson,
    password: a.stepPassword,
    interests: a.stepInterests,
  }[step];
  const entering = (direction === 'forward' ? FadeInRight : FadeInLeft)
    .duration(duration.base)
    .reduceMotion(ReduceMotion.System);

  let content: ReactNode;
  if (step === 'person') {
    content = (
      <>
        <StepHeader title={a.personTitle} intro={a.personIntro} />
        <Input
          label={a.firstName}
          value={firstName}
          onChangeText={setFirstName}
          error={personErrors.firstName}
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
          error={personErrors.lastName}
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
        <Input
          ref={emailRef}
          label={a.emailLabel}
          icon={Mail}
          value={email}
          onChangeText={setEmail}
          error={personErrors.email}
          placeholder={a.emailPlaceholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={submitPerson}
        />
        <Button label={t.common.next} size="lg" fullWidth onPress={submitPerson} />
        <Button label={a.toSignIn} variant="ghost" onPress={onSignIn} />
      </>
    );
  } else if (step === 'password') {
    content = (
      <>
        <StepHeader title={a.passwordTitle(firstName.trim())} intro={a.passwordIntro} />
        <Input
          label={a.password}
          value={password}
          onChangeText={setPassword}
          error={passwordErrors.password}
          autoFocus
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRepeatRef.current?.focus()}
        />
        <PasswordRules password={password} />
        <Input
          ref={passwordRepeatRef}
          label={a.passwordRepeat}
          value={passwordRepeat}
          onChangeText={setPasswordRepeat}
          error={passwordErrors.passwordRepeat}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={submitPassword}
        />
        <Button label={t.common.next} size="lg" fullWidth onPress={submitPassword} />
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
            {stepLabel}
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
