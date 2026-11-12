import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** error = rote Akzente, z. B. „Keine Verbindung“. */
  tone?: 'neutral' | 'error';
}

/** Gestalteter Leer- oder Fehlerzustand mit optionaler Aktion. */
export function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) {
  const iconColors =
    tone === 'error'
      ? { background: colors.status.error.subtle, foreground: colors.status.error.text }
      : { background: colors.accent.subtle, foreground: colors.accent.onSubtle };

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: iconColors.background }]}>
        <Icon size={28} color={iconColors.foreground} strokeWidth={2} />
      </View>
      <Text variant="title3" align="center" accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="callout" color="secondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    paddingHorizontal: space[8],
    paddingVertical: space[12],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[1],
  },
  action: { marginTop: space[2] },
});
