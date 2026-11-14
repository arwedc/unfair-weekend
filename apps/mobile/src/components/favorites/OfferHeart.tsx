import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { GlassSurface, PressableScale } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteOfferIds, useToggleFavoriteOffer } from '@/features/favorites/queries';
import { useT } from '@/lib/i18n/context';
import { badge, colors } from '@/theme';

const SIZE = 34;
/** Tippfläche auf mindestens 44 Punkte vergrößern, ohne den Kreis größer zu machen. */
const HIT_SLOP = (44 - SIZE) / 2;

export interface OfferHeartProps {
  offerId: string;
  /** Titel des Angebots, für Screenreader. */
  title: string;
}

/** Kleines Herz oben rechts auf dem Foto: Angebot merken. Ohne Konto geht es zur Anmeldung. */
export function OfferHeart({ offerId, title }: OfferHeartProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const { t } = useT();
  const { data: ids } = useFavoriteOfferIds();
  const toggle = useToggleFavoriteOffer();
  const saved = ids?.includes(offerId) ?? false;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={saved ? t.parts.card.unsave(title) : t.parts.card.save(title)}
      accessibilityState={{ selected: saved }}
      hitSlop={HIT_SLOP}
      pressedScale={0.85}
      onPress={() => {
        if (userId === null) {
          router.push('/anmelden');
          return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggle.mutate({ item: offerId, favorite: !saved });
      }}
      style={styles.button}
    >
      {/* Glas wie Tab-Leiste und Stadt-Kachel: das Foto scheint leicht durch. */}
      <GlassSurface style={styles.glass}>
        <Heart
          size={18}
          strokeWidth={2.25}
          color={saved ? colors.accent.strong : colors.text.primary}
          fill={saved ? colors.accent.solid : 'transparent'}
        />
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: badge.inset,
    right: badge.inset,
    width: SIZE,
    height: SIZE,
  },
  glass: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
