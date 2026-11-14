import type { ReviewSort } from '@/lib/reviews/filters';
import type { Widen } from '../widen';

export const reviewsDe = {
  title: 'Bewertungen',
  intro: 'Was Gäste nach dem Einlösen über deinen Standort sagen.',
  loading: 'Bewertungen werden geladen …',
  last30Days: (n: number) => `davon ${n} in den letzten 30 Tagen`,
  filterLabel: 'Nach Sternen filtern',
  stars: (n: number) => `${n} ${n === 1 ? 'Stern' : 'Sterne'}`,
  filterAria: (n: number, count: number, active: boolean) =>
    `${n} ${n === 1 ? 'Stern' : 'Sterne'}: ${count}${active ? ' (Filter aktiv, zum Aufheben klicken)' : ''}`,
  noText: 'Ohne Text',
  aboutOffer: 'Zu',
  hiddenBadge: 'Ausgeblendet: in der App nicht sichtbar und nicht im Durchschnitt',
  emptyTitle: 'Noch keine Bewertungen',
  emptyText:
    'Nach dem Einlösen eines Codes können Gäste deinen Standort in der App mit 1 bis 5 Sternen bewerten. Die Bewertungen erscheinen dann hier.',
  hiddenCount: (n: number) =>
    n === 1
      ? '1 Bewertung wurde vom Team ausgeblendet.'
      : `${n} Bewertungen wurden vom Team ausgeblendet.`,
  hiddenExplain: 'Sie stehen in der Liste, zählen aber nicht in den Durchschnitt.',
  all: 'Alle Bewertungen',
  clearFilter: 'Filter zurücksetzen',
  noMoreOnPage: 'Auf dieser Seite gibt es keine Bewertungen mehr.',
  noneForFilters: 'Keine Bewertungen für diese Auswahl.',
  listOptions: 'Sortierung und Zeitraum',
  sortLabel: 'Sortieren nach',
  sortOptions: {
    neueste: 'Neueste zuerst',
    aelteste: 'Älteste zuerst',
    beste: 'Beste zuerst',
    schlechteste: 'Schlechteste zuerst',
  } satisfies Record<ReviewSort, string>,
  periodLabel: 'Zeitraum',
  periodAll: 'Gesamter Zeitraum',
  periodOption: (days: number) => (days === 365 ? 'Letzte 12 Monate' : `Letzte ${days} Tage`),
  apply: 'Anwenden',
  pages: 'Seiten',
  previous: '← Vorherige',
  next: 'Nächste →',
  page: (n: number) => `Seite ${n}`,
  count: (n: number) => (n === 1 ? '1 Bewertung' : `${n} Bewertungen`),
  starsAria: (value: string) => `${value} von 5 Sternen`,
  date: {
    today: 'Heute',
    yesterday: 'Gestern',
    days: (n: number) => `vor ${n} Tagen`,
    weeks: (n: number) => (n === 1 ? 'vor 1 Woche' : `vor ${n} Wochen`),
    months: (n: number) => (n === 1 ? 'vor 1 Monat' : `vor ${n} Monaten`),
    years: (n: number) => (n === 1 ? 'vor 1 Jahr' : `vor ${n} Jahren`),
  },
};

export const reviewsEn: Widen<typeof reviewsDe> = {
  title: 'Reviews',
  intro: 'What guests say about your venue after redeeming.',
  loading: 'Loading reviews …',
  last30Days: (n) => `${n} of them in the last 30 days`,
  filterLabel: 'Filter by stars',
  stars: (n) => `${n} ${n === 1 ? 'star' : 'stars'}`,
  filterAria: (n, count, active) =>
    `${n} ${n === 1 ? 'star' : 'stars'}: ${count}${active ? ' (filter active, click to clear)' : ''}`,
  noText: 'No text',
  aboutOffer: 'For',
  hiddenBadge: 'Hidden: not visible in the app and not counted in the average',
  emptyTitle: 'No reviews yet',
  emptyText:
    'After redeeming a code, guests can rate your venue in the app with 1 to 5 stars. Their reviews will show up here.',
  hiddenCount: (n) =>
    n === 1 ? '1 review was hidden by the team.' : `${n} reviews were hidden by the team.`,
  hiddenExplain: 'They appear in the list but do not count towards the average.',
  all: 'All reviews',
  clearFilter: 'Reset filters',
  noMoreOnPage: 'There are no more reviews on this page.',
  noneForFilters: 'No reviews match this selection.',
  listOptions: 'Sorting and time period',
  sortLabel: 'Sort by',
  sortOptions: {
    neueste: 'Newest first',
    aelteste: 'Oldest first',
    beste: 'Highest rated first',
    schlechteste: 'Lowest rated first',
  },
  periodLabel: 'Time period',
  periodAll: 'All time',
  periodOption: (days) => (days === 365 ? 'Last 12 months' : `Last ${days} days`),
  apply: 'Apply',
  pages: 'Pages',
  previous: '← Previous',
  next: 'Next →',
  page: (n) => `Page ${n}`,
  count: (n) => (n === 1 ? '1 review' : `${n} reviews`),
  starsAria: (value) => `${value} out of 5 stars`,
  date: {
    today: 'Today',
    yesterday: 'Yesterday',
    days: (n) => `${n} days ago`,
    weeks: (n) => (n === 1 ? '1 week ago' : `${n} weeks ago`),
    months: (n) => (n === 1 ? '1 month ago' : `${n} months ago`),
    years: (n) => (n === 1 ? '1 year ago' : `${n} years ago`),
  },
};
