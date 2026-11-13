import { CalendarDays, PartyPopper, Sun, Sunrise, type LucideIcon } from 'lucide-react-native';

import type { TimeFilter } from '@/features/offers/feed-logic';

/** Ein Icon je Zeitfilter, gleich in der Filterzeile und im Filter-Sheet. */
export const TIME_ICONS = {
  alle: CalendarDays,
  heute: Sun,
  morgen: Sunrise,
  wochenende: PartyPopper,
} as const satisfies Record<TimeFilter, LucideIcon>;
