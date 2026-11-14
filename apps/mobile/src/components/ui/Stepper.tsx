import { Minus, Plus, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { colors, layout, radii, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Was gezählt wird, für Screenreader, z. B. „Plätze“. */
  label: string;
}

function StepButton({
  icon: Icon,
  label,
  disabled,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Icon size={22} color={colors.text.primary} strokeWidth={2.5} />
    </PressableScale>
  );
}

/** Zähler mit Minus und Plus, z. B. für die Platzwahl. */
export function Stepper({ value, min, max, onChange, label }: StepperProps) {
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && value < max) onChange(value + 1);
        if (event.nativeEvent.actionName === 'decrement' && value > min) onChange(value - 1);
      }}
    >
      <StepButton
        icon={Minus}
        label="Weniger"
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Text variant="title1" style={styles.value}>
        {value}
      </Text>
      <StepButton
        icon={Plus}
        label="Mehr"
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[6] },
  button: {
    width: layout.minTouchTarget + 8,
    height: layout.minTouchTarget + 8,
    borderRadius: radii.full,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.35 },
  value: { minWidth: 48, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
