import { StyleSheet, View } from 'react-native';

import { layout, space } from '@/theme';

import { Text } from './Text';

export interface SectionHeaderProps {
  title: string;
  /** Kleine Zeile rechts, z. B. die Anzahl. */
  detail?: string;
  /** Seitenrand selbst setzen, wenn der Abschnitt randlos ist (Karussell). */
  inset?: boolean;
}

/** Überschrift eines Abschnitts, z. B. „Heute in Münster“. */
export function SectionHeader({ title, detail, inset = false }: SectionHeaderProps) {
  return (
    <View style={[styles.row, inset && { paddingHorizontal: layout.screenPaddingX }]}>
      <Text variant="title2" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {detail ? (
        <Text variant="subhead" color="tertiary">
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  title: { flexShrink: 1 },
});
