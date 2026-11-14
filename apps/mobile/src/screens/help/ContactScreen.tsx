/**
 * Support kontaktieren: Nachricht schreiben und senden, darunter die E-Mail-Adresse.
 * Das Senden ist noch nicht angebunden (kein Backend). Ein Tipp erklärt das und verweist auf die E-Mail.
 */
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Page, Text } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { SUPPORT_EMAIL } from '@/lib/support';
import { colors, space } from '@/theme';

const MESSAGE_MAX = 2000;

export function ContactScreen() {
  const { t } = useT();
  const m = t.profile.contact;
  const [message, setMessage] = useState('');
  const [triedToSend, setTriedToSend] = useState(false);

  return (
    <Page>
      <Text variant="body" color="secondary">
        {m.intro}
      </Text>

      <View style={styles.form}>
        <Text variant="title3" accessibilityRole="header">
          {m.messageLabel}
        </Text>
        <Input
          tall
          accessibilityLabel={m.messageLabel}
          placeholder={m.placeholder}
          value={message}
          onChangeText={setMessage}
          maxLength={MESSAGE_MAX}
        />
        <Button
          label={m.send}
          icon={Send}
          size="lg"
          fullWidth
          disabled={message.trim().length === 0}
          onPress={() => setTriedToSend(true)}
        />
        {triedToSend ? (
          <Text variant="footnote" color="secondary" accessibilityLiveRegion="polite">
            {m.notYet}
          </Text>
        ) : null}
      </View>

      <View style={styles.divider} />

      <View style={styles.email}>
        <Text variant="title3" accessibilityRole="header">
          {m.emailTitle}
        </Text>
        <Text variant="body" color="secondary">
          {m.emailText}
        </Text>
        <Text variant="headline" selectable>
          {SUPPORT_EMAIL}
        </Text>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  form: { gap: space[3] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border.default },
  email: { gap: space[1] },
});
