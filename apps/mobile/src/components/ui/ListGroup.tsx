import { Children, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

export interface ListGroupProps {
  /** ListRows. `null`/`false` werden übersprungen (z. B. Zeilen nur mit Konto). */
  children: ReactNode;
}

/** Zeilen untereinander mit feiner Trennlinie, z. B. die Ordner im Profil. */
export function ListGroup({ children }: ListGroupProps) {
  return (
    <View>
      {Children.toArray(children).map((child, index) => (
        <View key={index} style={index > 0 && styles.divider}>
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
});
