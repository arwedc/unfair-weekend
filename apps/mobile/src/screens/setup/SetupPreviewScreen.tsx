/**
 * Vorschau für Phase 1 (Setup): zeigt die Komponentenbibliothek und prüft die Verbindung
 * zum Supabase-Dev-Projekt. Wird in Phase 2 durch den echten Feed ersetzt.
 */
import { OFFER_CATEGORIES, OFFER_CATEGORY_LABELS, type OfferCategory } from '@repo/shared';
import { formatDiscount, formatPrice } from '@repo/shared/utils';
import { CircleCheck, Search, Sparkles, WifiOff, Zap } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  Screen,
  Sheet,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, layout, space } from '@/theme';

type Connection =
  { state: 'loading' } | { state: 'ok'; offerCount: number } | { state: 'error'; message: string };

async function fetchConnection(): Promise<Connection> {
  const { data, error } = await supabase.rpc('list_offers', { p_limit: 50 });
  return error
    ? { state: 'error', message: error.message }
    : { state: 'ok', offerCount: data.length };
}

export function SetupPreviewScreen() {
  const [connection, setConnection] = useState<Connection>({ state: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState<OfferCategory | null>(null);
  const sheetRef = useRef<SheetRef>(null);

  useEffect(() => {
    let active = true;
    void fetchConnection().then((result) => {
      if (active) setConnection(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const checkConnection = useCallback(async () => {
    setConnection(await fetchConnection());
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await checkConnection();
    setRefreshing(false);
  };

  return (
    <Screen
      edgeToEdge
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          tintColor={colors.accent.solid}
        />
      }
    >
      <View style={styles.padded}>
        <Text variant="overline" color="accent">
          Phase 1 · Setup
        </Text>
        <Text variant="title1" accessibilityRole="header">
          Was geht heute in Münster?
        </Text>
        <Text variant="callout" color="secondary">
          Vorschau der Bausteine. Der echte Feed kommt in Phase 2.
        </Text>
      </View>

      <View style={styles.padded}>
        <ConnectionCard connection={connection} onRetry={checkConnection} />
      </View>

      <View style={styles.padded}>
        <Input icon={Search} shape="pill" placeholder="Kochkurs, Yoga, Weinprobe …" />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <Chip label="Alle" selected={category === null} onPress={() => setCategory(null)} />
        {OFFER_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={OFFER_CATEGORY_LABELS[value]}
            selected={category === value}
            onPress={() => setCategory(value)}
          />
        ))}
      </ScrollView>

      <View style={styles.padded}>
        <Text variant="title3" accessibilityRole="header">
          Beispiel-Karte
        </Text>
        <Card style={styles.dealCard}>
          <View style={styles.dealImage}>
            <View style={styles.badgeStack}>
              <Badge label={formatDiscount(40)} size="large" onImage />
              <Badge label="Nur heute" variant="urgent" icon={Zap} onImage />
            </View>
            <Badge label="Noch 2 Plätze" variant="neutral" onImage style={styles.seatBadge} />
          </View>
          <View style={styles.dealBody}>
            <Text variant="headline" numberOfLines={2}>
              Pasta-Kochkurs am Hafen
            </Text>
            <Text variant="subhead" color="secondary">
              Heute, 18:30 · Kreativkai
            </Text>
            <View style={styles.priceRow}>
              <Text variant="price" color="accent">
                {formatPrice(2900)}
              </Text>
              <Text variant="callout" color="tertiary" style={styles.strike}>
                {formatPrice(4900)}
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.padded}>
        <Text variant="title3" accessibilityRole="header">
          Lädt …
        </Text>
        <View style={styles.skeletonRow}>
          <Skeleton height={140} radius={layout.cardPadding + 4} />
          <Skeleton width="70%" />
          <Skeleton width="40%" />
        </View>
      </View>

      <View style={[styles.padded, styles.buttons]}>
        <Button
          label="Code holen"
          size="lg"
          fullWidth
          haptic
          onPress={() => sheetRef.current?.present()}
        />
        <Button label="Zweitaktion" variant="outline" fullWidth />
        <Button label="Textlink" variant="ghost" />
      </View>

      <Sheet ref={sheetRef} title="Bottom Sheet">
        <Text variant="callout" color="secondary">
          So öffnen sich später Vorschauen und Auswahl-Dialoge: von unten, mit Wischen schließbar.
        </Text>
        <Button label="Alles klar" fullWidth onPress={() => sheetRef.current?.dismiss()} />
      </Sheet>
    </Screen>
  );
}

function ConnectionCard({
  connection,
  onRetry,
}: {
  connection: Connection;
  onRetry: () => Promise<void>;
}) {
  if (connection.state === 'loading') {
    return <Skeleton height={64} />;
  }

  if (connection.state === 'error') {
    return (
      <Card elevation="flat" style={styles.connectionError}>
        <EmptyState
          icon={WifiOff}
          tone="error"
          title="Keine Verbindung zu Supabase"
          message={connection.message}
          actionLabel="Nochmal versuchen"
          onAction={() => void onRetry()}
        />
      </Card>
    );
  }

  return (
    <Card elevation="flat" style={styles.connectionOk}>
      <CircleCheck size={24} color={colors.status.success.text} />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">Verbunden mit dem Dev-Projekt</Text>
        <Text variant="subhead" color="secondary">
          {connection.offerCount} Angebote aus den Seed-Daten geladen
        </Text>
      </View>
      <Sparkles size={20} color={colors.accent.vivid} />
    </Card>
  );
}

const styles = StyleSheet.create({
  padded: { paddingHorizontal: layout.screenPaddingX, gap: space[3] },
  chipRow: { paddingHorizontal: layout.screenPaddingX, gap: space[2] },
  connectionOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    backgroundColor: colors.status.success.subtle,
  },
  connectionError: { backgroundColor: colors.status.error.subtle },
  dealCard: { marginTop: space[1] },
  dealImage: {
    height: 200,
    backgroundColor: colors.accent.subtle,
    padding: space[3],
    justifyContent: 'space-between',
  },
  badgeStack: { gap: space[1.5] },
  seatBadge: { alignSelf: 'flex-end' },
  dealBody: { padding: layout.cardPadding, gap: space[1] },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], marginTop: space[1] },
  strike: { textDecorationLine: 'line-through' },
  skeletonRow: { gap: space[2] },
  buttons: { alignItems: 'center' },
});
