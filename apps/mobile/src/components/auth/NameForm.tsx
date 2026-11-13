import { profileSchema } from '@repo/shared';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Text } from '@/components/ui';
import { updateProfile } from '@/features/auth/api';
import { useAuth } from '@/features/auth/auth-context';
import { errorMessage } from '@/lib/api-error';
import { colors, space } from '@/theme';

export interface NameFormProps {
  initialFirstName?: string;
  initialLastName?: string;
  submitLabel: string;
  onSaved: () => void;
}

/** Vor- und Nachname erfassen. Der Name steht später auf der Teilnehmerliste des Anbieters. */
export function NameForm({
  initialFirstName = '',
  initialLastName = '',
  submitLabel,
  onSaved,
}: NameFormProps) {
  const { refetchAccount } = useAuth();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [fieldErrors, setFieldErrors] = useState<{ first_name?: string; last_name?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const parsed = profileSchema.safeParse({ first_name: firstName, last_name: lastName });
    if (!parsed.success) {
      const errors: { first_name?: string; last_name?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'first_name' || field === 'last_name') errors[field] ??= issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setError(null);
    setSaving(true);
    try {
      await updateProfile(parsed.data.first_name, parsed.data.last_name);
      await refetchAccount();
      onSaved();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <Input
        label="Vorname"
        value={firstName}
        onChangeText={setFirstName}
        error={fieldErrors.first_name}
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
      />
      <Input
        label="Nachname"
        value={lastName}
        onChangeText={setLastName}
        error={fieldErrors.last_name}
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {error ? (
        <Text variant="footnote" style={{ color: colors.status.error.text }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={submitLabel}
        size="lg"
        fullWidth
        loading={saving}
        onPress={() => void save()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[4] },
});
