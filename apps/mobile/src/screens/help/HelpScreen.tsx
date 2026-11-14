/** Hilfe & Support: Häufige Fragen, Support kontaktieren und der Rundgang durch die App. */
import { useRouter } from 'expo-router';
import { CircleHelp, Compass, MessageCircle } from 'lucide-react-native';

import { ListGroup, ListRow, Page, Text } from '@/components/ui';
import { useOnboarding } from '@/features/onboarding/onboarding-context';
import { useT } from '@/lib/i18n/context';

export function HelpScreen() {
  const router = useRouter();
  const { replay } = useOnboarding();
  const { t } = useT();
  const m = t.profile.help;

  return (
    <Page>
      <Text variant="body" color="secondary">
        {m.intro}
      </Text>
      <ListGroup>
        <ListRow
          icon={CircleHelp}
          title={m.faq}
          detail={m.faqHint}
          onPress={() => router.push('/hilfe/faq')}
        />
        <ListRow
          icon={MessageCircle}
          title={m.contact}
          detail={m.contactHint}
          onPress={() => router.push('/hilfe/kontakt')}
        />
        <ListRow icon={Compass} title={m.tour} detail={m.tourHint} onPress={replay} />
      </ListGroup>
    </Page>
  );
}
