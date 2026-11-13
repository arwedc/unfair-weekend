import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, layout, radius, space } from '@/theme';

const PAGES = {
  datenschutz: {
    title: 'Datenschutz',
    intro:
      'Hier steht später die Datenschutzerklärung: welche Daten die App speichert (Name, E-Mail, Codes, Favoriten), wofür und wie du sie löschen kannst.',
  },
  impressum: {
    title: 'Impressum',
    intro: 'Hier stehen später Anbieter, Anschrift und Kontakt nach § 5 DDG.',
  },
} as const;

export type LegalPage = keyof typeof PAGES;

export function isLegalPage(value: unknown): value is LegalPage {
  return value === 'datenschutz' || value === 'impressum';
}

/** Platzhalter für Datenschutz und Impressum. Die echten Texte kommen vor dem Start. */
export function LegalScreen({ page }: { page: LegalPage }) {
  const content = PAGES[page];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: content.title }} />
      <View style={styles.placeholder}>
        <Text variant="overline" color="tertiary">
          Platzhalter
        </Text>
        <Text variant="body" color="secondary">
          {content.intro}
        </Text>
      </View>
      <Text variant="footnote" color="tertiary">
        Diese Testversion ist noch nicht öffentlich. Der endgültige Text wird vor dem Start ergänzt.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  content: { paddingHorizontal: layout.screenPaddingX, paddingVertical: space[4], gap: space[4] },
  placeholder: {
    gap: space[2],
    padding: space[4],
    borderRadius: radius.card,
    backgroundColor: colors.background.subtle,
  },
});
