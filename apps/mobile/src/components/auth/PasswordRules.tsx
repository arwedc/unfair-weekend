import { Circle, CircleCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { PASSWORD_RULES, passwordRules, type PasswordRule } from '@/features/auth/register-logic';
import { useT } from '@/lib/i18n/context';
import { colors, space } from '@/theme';

export interface PasswordRulesProps {
  password: string;
}

/** Regeln für ein neues Passwort mit Haken, die sich beim Tippen füllen. */
export function PasswordRules({ password }: PasswordRulesProps) {
  const { t } = useT();
  const a = t.common.auth;
  const met = passwordRules(password);
  const labels: Record<PasswordRule, string> = {
    length: a.passwordRuleLength,
    case: a.passwordRuleCase,
    digit: a.passwordRuleDigit,
  };

  return (
    <View style={styles.list}>
      {PASSWORD_RULES.map((rule) => {
        const done = met[rule];
        const Icon = done ? CircleCheck : Circle;
        return (
          <View
            key={rule}
            accessible
            accessibilityLabel={`${labels[rule]}: ${done ? a.ruleMet : a.ruleOpen}`}
            style={styles.row}
          >
            <Icon
              size={16}
              color={done ? colors.status.success.text : colors.text.tertiary}
              strokeWidth={2.25}
            />
            <Text variant="footnote" color={done ? 'primary' : 'secondary'}>
              {labels[rule]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space[1.5], marginTop: -space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
});
