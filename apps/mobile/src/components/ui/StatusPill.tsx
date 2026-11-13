import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '@/theme';

import { Text } from './Text';

export type StatusTone = 'success' | 'neutral' | 'warning' | 'error';

export interface StatusPillProps {
  label: string;
  tone?: StatusTone;
}

const tones: Record<StatusTone, { background: string; foreground: string }> = {
  success: { background: colors.status.success.subtle, foreground: colors.status.success.onSubtle },
  warning: { background: colors.status.warning.subtle, foreground: colors.status.warning.onSubtle },
  error: { background: colors.status.error.subtle, foreground: colors.status.error.onSubtle },
  neutral: { background: colors.background.muted, foreground: colors.text.secondary },
};

/** Kleine Statusmarke, z. B. „Aktiv“, „Eingelöst“, „Abgesagt“. */
export function StatusPill({ label, tone = 'neutral' }: StatusPillProps) {
  const palette = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.background }]}>
      <Text variant="caption" style={{ color: palette.foreground }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radii.full,
  },
});
