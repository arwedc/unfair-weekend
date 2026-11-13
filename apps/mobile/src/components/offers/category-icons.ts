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

/** Ein Icon pro Kategorie, für Chips und Vorschläge. */
export const CATEGORY_ICONS = {
  kochen_essen: ChefHat,
  sport_bewegung: Dumbbell,
  kreativ_workshops: Palette,
  wellness_beauty: Sparkles,
  kultur_events: Drama,
  sonstiges: Shapes,
} as const satisfies Record<OfferCategory, LucideIcon>;
