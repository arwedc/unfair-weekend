import type { OfferCategory } from '@repo/shared';

import type { FunTint } from '@/theme';

/**
 * Emoji und bunter Ton je Kategorie für „Entdecken“ (runde Kacheln und Etikett auf dem Foto).
 * Kurznamen stehen in den Übersetzungen (`t.parts.categoryShort`). In Filter und Karte bleiben
 * die ruhigen Lucide-Icons (`components/offers/category-icons.ts`).
 */
export const CATEGORY_EMOJIS = {
  kochen_essen: { emoji: '🍝', tint: 'peach' },
  sport_bewegung: { emoji: '🏋️', tint: 'mint' },
  kreativ_workshops: { emoji: '🎨', tint: 'lilac' },
  wellness_beauty: { emoji: '💆', tint: 'pink' },
  kultur_events: { emoji: '🎭', tint: 'sky' },
  sonstiges: { emoji: '✨', tint: 'lemon' },
} as const satisfies Record<OfferCategory, { emoji: string; tint: FunTint }>;
