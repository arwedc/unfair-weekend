import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, layout, MAX_FONT_SCALE, radius, space, textStyle } from '@/theme';

import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  /** Fehlertext unter dem Feld (z. B. aus der Zod-Validierung). */
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  /** Runde Pillenform, z. B. für die Suche. */
  shape?: 'default' | 'pill';
}

export function Input({
  label,
  error,
  hint,
  icon: Icon,
  shape = 'default',
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.status.error.solid
    : focused
      ? colors.border.focus
      : colors.border.default;

  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="subhead" color="secondary">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          shape === 'pill' ? styles.pill : styles.rounded,
          { borderColor, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {Icon ? <Icon size={20} color={colors.text.tertiary} /> : null}
        <TextInput
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.accent.solid}
          cursorColor={colors.accent.solid}
          maxFontSizeMultiplier={MAX_FONT_SCALE}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[textStyle('body'), styles.input]}
          {...rest}
        />
      </View>
      {error ? (
        <Text variant="footnote" style={{ color: colors.status.error.text }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="footnote" color="tertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space[1.5] },
  field: {
    minHeight: layout.minTouchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingHorizontal: space[4],
    backgroundColor: colors.surface.default,
  },
  rounded: { borderRadius: radius.input, borderCurve: 'continuous' },
  pill: { borderRadius: radius.button },
  input: { flex: 1, color: colors.text.primary, paddingVertical: space[3] },
});
