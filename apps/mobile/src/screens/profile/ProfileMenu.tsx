/** Ordner unten im Profil (Mitgliedschaft, Hilfe & Support, …) und die Einladungskarte. */
import { useRouter, type Href } from 'expo-router';
import {
  BadgeCheck,
  BookText,
  CircleHelp,
  Gift,
  Settings,
  Share2,
  type LucideIcon,
} from 'lucide-react-native';
import { Share, StyleSheet, View } from 'react-native';

import { Button, ListGroup, ListRow, Text } from '@/components/ui';
import { useT } from '@/lib/i18n/context';
import { radius, soft, space } from '@/theme';

interface MenuItem {
  icon: LucideIcon;
  title: string;
  href: Href;
}

/**
 * Die Ordner in fester Reihenfolge. Ohne Konto fehlen Mitgliedschaft und Geschenkkarte,
 * weil beide ein Konto brauchen.
 */
export function ProfileMenu({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const { t } = useT();
  const m = t.profile.menu;
  const items: (MenuItem | false)[] = [
    signedIn && { icon: BadgeCheck, title: m.membership, href: '/mitgliedschaft' },
    { icon: CircleHelp, title: m.help, href: '/hilfe' },
    signedIn && { icon: Gift, title: m.giftCard, href: '/geschenkkarte' },
    { icon: Settings, title: m.settings, href: '/einstellungen' },
    { icon: BookText, title: m.legal, href: '/rechtliches' },
  ];

  return (
    <ListGroup>
      {items
        .filter((item): item is MenuItem => item !== false)
        .map((item) => (
          <ListRow
            key={item.title}
            icon={item.icon}
            title={item.title}
            onPress={() => router.push(item.href)}
          />
        ))}
    </ListGroup>
  );
}

/** Freunde einladen: warme Karte mit Teilen-Knopf (öffnet das Teilen-Menü des Handys). */
export function InviteCard() {
  const { t } = useT();
  const m = t.profile.invite;
  return (
    <View style={styles.invite}>
      <Text variant="title3">{m.title}</Text>
      <Text variant="callout" color="secondary">
        {m.text}
      </Text>
      <Button
        label={m.button}
        icon={Share2}
        onPress={() => void Share.share({ message: t.common.profile.inviteMessage })}
        style={styles.inviteButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  invite: {
    gap: space[2],
    padding: space[5],
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: soft.warm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: soft.tintStrong,
  },
  inviteButton: { alignSelf: 'flex-start', marginTop: space[2] },
});
