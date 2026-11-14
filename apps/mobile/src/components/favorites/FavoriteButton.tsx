import { useRouter } from 'expo-router';
import { Heart } from 'lucide-react-native';

import { PressableScale } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { useFavoriteLocationIds, useToggleFavoriteLocation } from '@/features/favorites/queries';
import { haptics } from '@/lib/haptics';
import { colors, layout } from '@/theme';

export interface FavoriteButtonProps {
  locationId: string;
  /** Name des Anbieters, für Screenreader. */
  name: string;
}

/** Herz zum Merken eines Standorts. Ohne Konto führt es zur Anmeldung. */
export function FavoriteButton({ locationId, name }: FavoriteButtonProps) {
  const router = useRouter();
  const { userId } = useAuth();
  const { data: ids } = useFavoriteLocationIds();
  const toggle = useToggleFavoriteLocation();
  const favorite = ids?.includes(locationId) ?? false;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        favorite ? `${name} aus Lieblingsorten entfernen` : `${name} als Lieblingsort merken`
      }
      accessibilityState={{ selected: favorite }}
      hitSlop={8}
      pressedScale={0.85}
      onPress={() => {
        if (userId === null) {
          router.push('/anmelden');
          return;
        }
        haptics.tap();
        toggle.mutate({ item: locationId, favorite: !favorite });
      }}
      style={{
        width: layout.minTouchTarget,
        height: layout.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Heart
        size={24}
        strokeWidth={2}
        color={favorite ? colors.accent.strong : colors.text.primary}
        fill={favorite ? colors.accent.solid : 'transparent'}
      />
    </PressableScale>
  );
}
