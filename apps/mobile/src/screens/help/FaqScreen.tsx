/** Häufige Fragen: Frage antippen klappt die Antwort auf. Mehrere dürfen offen sein. */
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ListGroup, Page, PressableScale, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { colors, layout, space } from '@/theme';

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <View>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={question}
        accessibilityHint={open ? t.profile.faq.close : t.profile.faq.open}
        accessibilityState={{ expanded: open }}
        pressedScale={0.99}
        onPress={() => {
          haptics.selection();
          setOpen((value) => !value);
        }}
        style={styles.question}
      >
        <Text variant="headline" style={styles.questionText}>
          {question}
        </Text>
        <Icon size={20} color={colors.text.tertiary} />
      </PressableScale>
      {open ? (
        <Text variant="body" color="secondary" style={styles.answer}>
          {answer}
        </Text>
      ) : null}
    </View>
  );
}

export function FaqScreen() {
  const { t } = useT();
  return (
    <Page>
      <ListGroup>
        {t.profile.faq.items.map((item) => (
          <FaqItem key={item.q} question={item.q} answer={item.a} />
        ))}
      </ListGroup>
    </Page>
  );
}

const styles = StyleSheet.create({
  question: {
    minHeight: layout.minTouchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  questionText: { flex: 1 },
  answer: { paddingBottom: space[4] },
});
