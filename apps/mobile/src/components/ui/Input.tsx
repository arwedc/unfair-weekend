import { X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode, type Ref } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { colors, layout, MAX_FONT_SCALE, radius, shadow, space, textStyle } from '@/theme';

import { Text } from './Text';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  ref?: Ref<TextInputInstance>;
  label?: string;
  /** Fehlertext unter dem Feld (z. B. aus der Zod-Validierung). */
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  /** Runde Pillenform, z. B. für die Suche. */
  shape?: 'default' | 'pill';
  /** Mit Schatten statt Rahmen, z. B. schwebend über der Karte. */
  elevated?: boolean;
  /** Zeigt ein „x“ zum Leeren, sobald etwas eingegeben ist. */
  onClear?: () => void;
  /** Eigenes Element am Ende des Felds, z. B. ein Knopf zum Schließen der Suche. */
  trailing?: ReactNode;
}

export function Input({
  ref,
  label,
  error,
  hint,
  icon: Icon,
  shape = 'default',
  elevated = false,
  onClear,
  trailing,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.status.error.solid
    : focused
      ? colors.border.focus
      : elevated
        ? 'transparent'
        : colors.border.default;
  const showClear = onClear !== undefined && (rest.value ?? '').length > 0;

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
          elevated && styles.elevated,
          { borderColor, borderWidth: focused || error ? 1.5 : 1 },
        ]}
      >
        {Icon ? <Icon size={20} color={colors.text.tertiary} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label ?? rest.placeholder}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.accent.strong}
          cursorColor={colors.accent.strong}
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
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eingabe löschen"
            onPress={onClear}
            hitSlop={12}
            style={styles.clear}
          >
            <X size={14} color={colors.text.inverse} strokeWidth={3} />
          </Pressable>
        ) : null}
        {trailing}
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
  elevated: { boxShadow: shadow.floating },
  input: { flex: 1, color: colors.text.primary, paddingVertical: space[3] },
  clear: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text.tertiary,
  },
});
