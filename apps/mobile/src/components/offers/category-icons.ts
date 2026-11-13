import type { OfferCategory } from '@repo/shared';
import {
  ChefHat,
  Drama,
  Dumbbell,
  Palette,
  Shapes,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';

/** Ein Lucide-Icon je Kategorie, gleich in Filter, Sheet und Karte. */
export const CATEGORY_ICONS = {
  kochen_essen: ChefHat,
  sport_bewegung: Dumbbell,
  kreativ_workshops: Palette,
  wellness_beauty: Sparkles,
  kultur_events: Drama,
  sonstiges: Shapes,
} as const satisfies Record<OfferCategory, LucideIcon>;
