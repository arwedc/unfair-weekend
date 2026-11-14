import { CalendarClock, PartyPopper, Sun, Sunrise, type LucideIcon } from 'lucide-react-native';

import type { TimeFilter } from '@/features/offers/feed-logic';

/** Ein Icon je Zeitfilter in der Filterzeile. */
export const TIME_ICONS = {
  heute: Sun,
  morgen: Sunrise,
  uebermorgen: CalendarClock,
  wochenende: PartyPopper,
} as const satisfies Record<TimeFilter, LucideIcon>;
