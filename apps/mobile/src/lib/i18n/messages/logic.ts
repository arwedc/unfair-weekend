import type { Widen } from './widen';

/**
 * Texte der reinen Logik in `src/features` (Feed, Codes, Bewertungen, Push, Konto).
 * Die deutschen Texte sind genau die, die die Tests erwarten.
 */
export const logicDe = {
  timeFilters: {
    heute: 'Heute',
    morgen: 'Morgen',
    uebermorgen: 'Übermorgen',
    wochenende: 'Wochenende',
  },
  sections: {
    lastMinute: 'Last Minute ⏰',
    trending: 'Gerade angesagt 🔥',
    highlights: 'Community-Lieblinge ⭐',
    deals: 'Mega-Rabatte 💥',
    new: 'Frisch reingekommen ✨',
    crew: 'Bring deine Crew 👯',
    budget: 'Schnäppchen 💸',
  },
  redeemUntil: (day: string) => `Einlösbar bis ${day}`,
  redeemRange: (range: string) => `Einlösbar ${range}`,
  cancelPolicy: {
    period: 'Kostenlos stornierbar, solange du den Code nicht eingelöst hast.',
    unknown: 'Kostenlos stornierbar bis kurz vor Beginn.',
    untilStart: 'Kostenlos stornierbar bis zum Beginn.',
    hours: (hours: number) => `Kostenlos stornierbar bis ${hours} Std. vor Beginn.`,
  },
  voucherStatus: {
    aktiv: 'Aktiv',
    eingeloest: 'Eingelöst',
    storniert: 'Storniert',
    abgelaufen: 'Abgelaufen',
    no_show: 'Nicht erschienen',
    abgesagt: 'Abgesagt',
  },
  cancelHint: {
    period: 'Du kannst kostenlos stornieren, solange du den Code nicht eingelöst hast.',
    until: (when: string) => `Kostenlos stornierbar bis ${when} Uhr.`,
    over: (when: string) => `Die Stornofrist ist seit ${when} Uhr vorbei.`,
    none: 'Dieser Code lässt sich nicht mehr stornieren.',
  },
  past: {
    redeemedOn: (day: string) => `Eingelöst am ${day}`,
    redeemed: 'Eingelöst',
    offerCancelled: 'Der Anbieter hat das Angebot abgesagt.',
    cancelledOn: (day: string) => `Storniert am ${day}`,
    cancelled: 'Storniert',
    noShow: 'Du bist nicht erschienen.',
    expired: 'Nicht eingelöst.',
  },
  seats: (n: number) => (n === 1 ? '1 Platz' : `${n} Plätze`),
  reviewCount: (n: number) => (n === 1 ? '1 Bewertung' : `${n} Bewertungen`),
  ratingWords: {
    1: 'Leider nicht gut',
    2: 'Geht so',
    3: 'Ganz okay',
    4: 'Richtig gut',
    5: 'Großartig!',
  },
  reviewDate: {
    today: 'Heute',
    yesterday: 'Gestern',
    days: (n: number) => `vor ${n} Tagen`,
    weeks: (n: number) => (n === 1 ? 'vor 1 Woche' : `vor ${n} Wochen`),
    months: (n: number) => (n === 1 ? 'vor 1 Monat' : `vor ${n} Monaten`),
    years: (n: number) => (n === 1 ? 'vor 1 Jahr' : `vor ${n} Jahren`),
  },
  push: {
    expoGo: 'Kommt mit der fertigen App. In Expo Go gibt es keine Push-Nachrichten.',
    simulator: 'Geht nur auf einem echten Handy.',
    noProject: 'In dieser Testversion noch nicht eingerichtet.',
    web: 'Im Browser nicht verfügbar.',
    denied: 'In den Handy-Einstellungen ausgeschaltet. Tipp hier, um sie zu öffnen.',
    on: 'Neue Angebote deiner Favoriten, Erinnerungen vor dem Start und Absagen.',
    off: 'Wir melden uns nur, wenn es um deine Codes und Favoriten geht.',
  },
  blocked: (until: string | null) =>
    `Du kannst${until ? ` bis zum ${until}` : ''} keine Codes holen, weil du mehrfach nicht erschienen bist. Danach geht es wieder.`,
};

export const logicEn: Widen<typeof logicDe> = {
  timeFilters: {
    heute: 'Today',
    morgen: 'Tomorrow',
    uebermorgen: 'In 2 days',
    wochenende: 'Weekend',
  },
  sections: {
    lastMinute: 'Last minute ⏰',
    trending: 'Trending now 🔥',
    highlights: 'Community favourites ⭐',
    deals: 'Mega deals 💥',
    new: 'Fresh drops ✨',
    crew: 'Bring your crew 👯',
    budget: 'Steals 💸',
  },
  redeemUntil: (day) => `Redeemable until ${day}`,
  redeemRange: (range) => `Redeemable ${range}`,
  cancelPolicy: {
    period: 'Free cancellation as long as you haven’t redeemed the code.',
    unknown: 'Free cancellation until shortly before the start.',
    untilStart: 'Free cancellation until the start.',
    hours: (hours) =>
      `Free cancellation up to ${hours} ${hours === 1 ? 'hour' : 'hours'} before the start.`,
  },
  voucherStatus: {
    aktiv: 'Active',
    eingeloest: 'Redeemed',
    storniert: 'Cancelled',
    abgelaufen: 'Expired',
    no_show: 'No-show',
    abgesagt: 'Called off',
  },
  cancelHint: {
    period: 'You can cancel for free as long as you haven’t redeemed the code.',
    until: (when) => `Free cancellation until ${when}.`,
    over: (when) => `The cancellation deadline passed on ${when}.`,
    none: 'This code can no longer be cancelled.',
  },
  past: {
    redeemedOn: (day) => `Redeemed on ${day}`,
    redeemed: 'Redeemed',
    offerCancelled: 'The venue called off the offer.',
    cancelledOn: (day) => `Cancelled on ${day}`,
    cancelled: 'Cancelled',
    noShow: 'You didn’t show up.',
    expired: 'Not redeemed.',
  },
  seats: (n) => (n === 1 ? '1 spot' : `${n} spots`),
  reviewCount: (n) => (n === 1 ? '1 review' : `${n} reviews`),
  ratingWords: {
    1: 'Not good, sadly',
    2: 'So-so',
    3: 'Pretty okay',
    4: 'Really good',
    5: 'Amazing!',
  },
  reviewDate: {
    today: 'Today',
    yesterday: 'Yesterday',
    days: (n) => `${n} days ago`,
    weeks: (n) => (n === 1 ? '1 week ago' : `${n} weeks ago`),
    months: (n) => (n === 1 ? '1 month ago' : `${n} months ago`),
    years: (n) => (n === 1 ? '1 year ago' : `${n} years ago`),
  },
  push: {
    expoGo: 'Coming with the finished app. Expo Go can’t receive push notifications.',
    simulator: 'Only works on a real phone.',
    noProject: 'Not set up in this test version yet.',
    web: 'Not available in the browser.',
    denied: 'Turned off in your phone settings. Tap here to open them.',
    on: 'New offers from your favourites, reminders before the start and cancellations.',
    off: 'We only get in touch about your codes and favourites.',
  },
  blocked: (until) =>
    `You can’t get codes${until ? ` until ${until}` : ''} because you didn’t show up several times. After that it works again.`,
};
