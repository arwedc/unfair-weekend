import { formatPrice } from '@repo/shared';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { space } from '@/theme';

export interface PriceRowProps {
  originalPriceCents: number;
  dealPriceCents: number;
  /** „large“ für die Detailseite. */
  size?: 'default' | 'large';
}

/** Deal-Preis groß und kräftig, der alte Preis durchgestrichen daneben. */
export function PriceRow({ originalPriceCents, dealPriceCents, size = 'default' }: PriceRowProps) {
  const deal = formatPrice(dealPriceCents, { omitZeroCents: true });
  const original = formatPrice(originalPriceCents, { omitZeroCents: true });

  return (
    <View style={styles.row} accessible accessibilityLabel={`${deal} statt ${original}`}>
      <Text variant={size === 'large' ? 'title1' : 'price'}>{deal}</Text>
      <Text
        variant={size === 'large' ? 'body' : 'subhead'}
        color="tertiary"
        style={styles.original}
      >
        {original}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  original: { textDecorationLine: 'line-through' },
});
