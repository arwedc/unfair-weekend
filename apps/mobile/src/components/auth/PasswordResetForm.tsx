import { emailSchema, otpVerifySchema } from '@repo/shared';
import { KeyRound, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Text } from '@/components/ui';
import { cleanEmailCode, firstIssueMessage } from '@/features/auth/account';
import { requestPasswordReset, updatePassword, verifyPasswordResetCode } from '@/features/auth/api';
import { checkPasswordStep } from '@/features/auth/register-logic';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, space } from '@/theme';

import { PasswordRules } from './PasswordRules';

export interface PasswordResetFormProps {
  initialEmail?: string;
  /** Neues Passwort ist gespeichert, der Nutzer ist jetzt angemeldet. */
  onDone: () => void;
  onCancel: () => void;
}

type Busy = 'send' | 'save' | null;

/**
 * Passwort vergessen: Code per E-Mail anfordern, Code und neues Passwort eingeben.
 * Ein Code statt Link, weil Links aus der Mail-App Expo Go nicht öffnen und man die
 * E-Mail auch am Rechner lesen kann. Nach dem Code ist der Nutzer angemeldet.
 */
export function PasswordResetForm({ initialEmail = '', onDone, onCancel }: PasswordResetFormProps) {
  const { t, locale } = useT();
  const a = t.common.auth;
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  /** Der Code ist schon eingelöst (Session besteht), es fehlt nur noch das Passwort. */
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setBusy(kind);
    try {
      await action();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const sendCode = (again: boolean) => {
    const parsed = emailSchema.safeParse(email.trim().toLowerCase());
    if (!parsed.success) {
      setError(firstIssueMessage(parsed.error, locale, t.common.checkInput));
      return;
    }
    void run('send', async () => {
      await requestPasswordReset(parsed.data);
      setEmail(parsed.data);
      setStep('code');
      if (again) setNotice(a.codeResent);
    });
  };

  const save = () => {
    const parsedCode = otpVerifySchema.safeParse({ email, token: cleanEmailCode(code) });
    if (!verified && !parsedCode.success) {
      setError(firstIssueMessage(parsedCode.error, locale, t.common.checkInput));
      return;
    }
    // Dieselben Regeln wie bei der Registrierung (Länge, Groß/klein, Zahl, zweimal gleich).
    const passwordCheck = checkPasswordStep(password, passwordConfirmation, locale);
    if (!passwordCheck.ok) {
      const { password: passwordError, passwordRepeat } = passwordCheck.errors;
      setError(passwordError ?? passwordRepeat ?? t.common.checkInput);
      return;
    }
    void run('save', async () => {
      if (!verified && parsedCode.success) {
        await verifyPasswordResetCode(parsedCode.data.email, parsedCode.data.token);
        setVerified(true);
      }
      await updatePassword(password);
      onDone();
    });
  };

  const feedback = (
    <>
      {notice ? (
        <Text variant="footnote" color="secondary" accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text
          variant="callout"
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{ color: colors.status.error.text }}
        >
          {error}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={styles.form}>
      <View style={styles.intro}>
        <Text variant="title1" accessibilityRole="header">
          {a.resetTitle}
        </Text>
        <Text variant="body" color="secondary">
          {step === 'email' ? a.resetIntro : a.resetCodeIntro(email)}
        </Text>
      </View>

      {step === 'email' ? (
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
            returnKeyType="send"
            onSubmitEditing={() => sendCode(false)}
          />
          {feedback}
          <Button
            label={a.sendCode}
            size="lg"
            fullWidth
            loading={busy === 'send'}
            disabled={busy !== null && busy !== 'send'}
            onPress={() => sendCode(false)}
          />
          <Button label={a.toLogin} variant="ghost" onPress={onCancel} />
        </>
      ) : (
        <>
          {verified ? null : (
            <Input
              label={a.code}
              icon={KeyRound}
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              autoCorrect={false}
            />
          )}
          <Input
            label={a.newPassword}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="new-password"
            textContentType="newPassword"
          />
          <PasswordRules password={password} />
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
            onSubmitEditing={save}
          />
          {feedback}
          <Button
            label={a.savePassword}
            size="lg"
            fullWidth
            loading={busy === 'save'}
            disabled={busy !== null && busy !== 'save'}
            onPress={save}
          />
          {verified ? null : (
            <>
              <Button
                label={a.resendCode}
                variant="ghost"
                loading={busy === 'send'}
                disabled={busy !== null && busy !== 'send'}
                onPress={() => sendCode(true)}
              />
              <Button
                label={a.otherEmail}
                variant="ghost"
                disabled={busy !== null}
                onPress={() => {
                  setError(null);
                  setNotice(null);
                  setCode('');
                  setStep('email');
                }}
              />
            </>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
  intro: { gap: space[2], marginBottom: space[2] },
});
