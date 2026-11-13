import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteOfferIds, useToggleFavoriteOffer } from '@/features/favorites/queries';
import { colors, layout, radii, shadow, space } from '@/theme';

export interface OfferFavoriteButtonProps {
  offerId: string;
  /** Titel des Angebots, für Screenreader. */
  title: string;
  /** „image“ = kleiner weißer Kreis auf dem Foto, „floating“ = großer runder Knopf (Detailseite). */
  variant?: 'image' | 'floating';
  style?: StyleProp<ViewStyle>;
}

/** Herz zum Merken eines Angebots. Ohne Konto führt es zur Anmeldung. */
export function OfferFavoriteButton({
  offerId,
  title,
  variant = 'image',
  style,
}: OfferFavoriteButtonProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const { data: ids } = useFavoriteOfferIds();
  const toggle = useToggleFavoriteOffer();
  const favorite = ids?.includes(offerId) ?? false;
  const small = variant === 'image';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={favorite ? `${title} aus Favoriten entfernen` : `${title} merken`}
      accessibilityState={{ selected: favorite }}
      hitSlop={small ? SMALL_HIT_SLOP : 0}
      pressedScale={0.85}
      onPress={() => {
        if (userId === null) {
          router.push('/anmelden');
          return;
        }
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        toggle.mutate({ item: offerId, favorite: !favorite });
      }}
      style={[styles.base, small ? styles.small : styles.floating, style]}
    >
      <Heart
        size={small ? 18 : 22}
        strokeWidth={2.25}
        color={favorite ? colors.accent.strong : colors.text.primary}
        fill={favorite ? colors.accent.solid : 'transparent'}
      />
    </PressableScale>
  );
}

const SMALL_SIZE = space[8] + space[1];
const SMALL_HIT_SLOP = (layout.minTouchTarget - SMALL_SIZE) / 2;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    backgroundColor: colors.surface.raised,
  },
  small: { width: SMALL_SIZE, height: SMALL_SIZE, boxShadow: shadow.badge },
  floating: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    boxShadow: shadow.floating,
  },
});
