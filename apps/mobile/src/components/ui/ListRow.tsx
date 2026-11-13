import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, layout, space } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ListRowProps {
  icon?: LucideIcon;
  title: string;
  detail?: string;
  onPress?: () => void;
  /** Rot, für endgültige Aktionen wie „Konto löschen“. */
  destructive?: boolean;
  /** Eigenes Element rechts statt des Pfeils, z. B. ein Herz-Button. */
  trailing?: ReactNode;
}

/** Zeile in einer Liste, z. B. im Profil. Mit onPress antippbar. */
export function ListRow({
  icon: Icon,
  title,
  detail,
  onPress,
  destructive,
  trailing,
}: ListRowProps) {
  const color = destructive ? colors.status.error.text : colors.text.primary;
  const content = (
    <>
      {Icon ? <Icon size={22} color={color} strokeWidth={2} /> : null}
      <View style={styles.text}>
        <Text variant="body" style={{ color }}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" color="secondary">
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing ?? (onPress ? <ChevronRight size={20} color={colors.text.tertiary} /> : null)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, detail].filter(Boolean).join(', ')}
      onPress={onPress}
      pressedScale={0.99}
      style={styles.row}
    >
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
  },
  text: { flex: 1, gap: space[0.5] },
});
