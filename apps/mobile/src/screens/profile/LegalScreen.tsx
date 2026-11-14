import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { colors, layout, radius, space } from '@/theme';

export type LegalPage = 'nutzungsbedingungen' | 'datenschutz' | 'impressum';

export function isLegalPage(value: unknown): value is LegalPage {
  return value === 'nutzungsbedingungen' || value === 'datenschutz' || value === 'impressum';
}

/** Platzhalter für Nutzungsbedingungen, Datenschutz und Impressum. Die echten Texte kommen vor dem Start. */
export function LegalScreen({ page }: { page: LegalPage }) {
  const { t } = useT();
  const content = {
    nutzungsbedingungen: { title: t.common.profile.terms, intro: t.common.legal.termsIntro },
    datenschutz: { title: t.common.profile.privacy, intro: t.common.legal.privacyIntro },
    impressum: { title: t.common.profile.imprint, intro: t.common.legal.imprintIntro },
  }[page];
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    >
      <Stack.Screen options={{ title: content.title }} />
      <View style={styles.placeholder}>
        <Text variant="overline" color="tertiary">
          {t.common.legal.placeholder}
        </Text>
        <Text variant="body" color="secondary">
          {content.intro}
        </Text>
      </View>
      <Text variant="footnote" color="tertiary">
        {t.common.legal.notPublic}
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
