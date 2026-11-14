import type { Widen } from './widen';

/**
 * Texte der Profil-Ordner: Menü, Profilbild, Einstellungen, Mitgliedschaft,
 * Hilfe & Support (FAQ, Kontakt), Geschenkkarte und Rechtliches.
 */
export const profileDe = {
  menu: {
    membership: 'Mitgliedschaft',
    help: 'Hilfe & Support',
    giftCard: 'Geschenkkarte senden',
    settings: 'Einstellungen',
    legal: 'Rechtliches',
  },
  invite: {
    title: 'Zusammen ist es unfairer',
    text: 'Zeig deinen Freunden die App und sichert euch die nächsten Deals gemeinsam.',
    button: 'Freunde einladen',
  },
  avatar: {
    title: 'Profilbild',
    change: 'Profilbild ändern',
    add: 'Profilbild hinzufügen',
    library: 'Aus der Mediathek wählen',
    camera: 'Foto aufnehmen',
    remove: 'Profilbild entfernen',
    saving: 'Profilbild wird gespeichert',
    hint: 'Dein Profilbild siehst nur du.',
    cameraDenied:
      'Die App darf die Kamera nicht nutzen. Du kannst das in den Handy-Einstellungen ändern.',
    openSettings: 'Handy-Einstellungen öffnen',
  },
  settings: {
    title: 'Einstellungen',
    deviceHint:
      'Standortzugriff und Mitteilungen erlaubst du in den Einstellungen deines Handys. Ein Tipp auf die Zeile bringt dich hin, falls die App nicht selbst fragen darf.',
    language: 'Sprache',
    languageTitle: 'Sprache wählen',
    notifications: 'Benachrichtigungen',
    location: 'Standortzugriff',
    locationOn: 'An: Angebote in deiner Nähe',
    locationAsk: 'Aus. Tippen, um ihn zu erlauben',
    locationDenied: 'Aus. Änderbar in den Handy-Einstellungen',
    privacy: 'Datenschutz',
    version: (v: string) => `Version ${v}`,
    deleteAccount: 'Konto löschen',
  },
  membership: {
    title: 'Mitgliedschaft',
    planLabel: 'Deine Mitgliedschaft',
    plan: 'Kostenlos',
    planText: 'Kein Abo, keine Gebühren. Du zahlst nur den vergünstigten Preis für das Angebot.',
    levelTitle: 'Deine Stufe',
    levelsTitle: 'Alle Stufen',
    reached: 'Erreicht',
    howText:
      'Jedes eingelöste Angebot zählt als Erlebnis. Stornierte und verpasste Termine zählen nicht.',
    signInTitle: 'Noch kein Konto',
    signInText: 'Melde dich an, dann siehst du hier deine Mitgliedschaft und deine Stufe.',
  },
  giftCard: {
    title: 'Geschenkkarte senden',
    soonTitle: 'Geschenkkarten kommen bald 🎁',
    soonText:
      'Bald kannst du Freunden ein Erlebnis in ihrer Stadt schenken. Wir sagen Bescheid, sobald es losgeht.',
  },
  help: {
    title: 'Hilfe & Support',
    intro: 'Hier findest du schnelle Antworten und den direkten Draht zu uns.',
    faq: 'Häufige Fragen',
    faqHint: 'Codes, Stornieren, Konto',
    contact: 'Support kontaktieren',
    contactHint: 'Schreib uns eine Nachricht',
    tour: 'App kurz erklärt',
    tourHint: 'Den Rundgang wiederholen',
  },
  faq: {
    title: 'Häufige Fragen',
    open: 'Antwort zeigen',
    close: 'Antwort ausblenden',
    items: [
      {
        q: 'Was ist unfair weekend?',
        a: 'Lokale Anbieter stellen hier kurzfristig Plätze zum Sonderpreis ein, zum Beispiel Kochkurse, Yoga oder Kultur. Du sicherst dir einen Platz per Code und gehst einfach hin.',
      },
      {
        q: 'Wie sichere ich mir ein Angebot?',
        a: 'Öffne das Angebot und tippe auf „Code holen“. Danach liegt der Code unter „Meine Codes“. Du brauchst dafür ein Konto mit Vor- und Nachnamen, damit der Anbieter dich auf seiner Teilnehmerliste findet.',
      },
      {
        q: 'Wie löse ich meinen Code ein?',
        a: 'Zeig vor Ort den QR-Code oder den Kurzcode aus „Meine Codes“. Bei festen Terminen geht das ab einer Stunde vor Beginn, bei Angeboten mit Zeitraum während des Zeitraums.',
      },
      {
        q: 'Kostet mich die App etwas?',
        a: 'Nein. Es gibt kein Abo und keine Gebühren. Du zahlst nur den vergünstigten Preis für das Angebot.',
      },
      {
        q: 'Kann ich einen Code stornieren?',
        a: 'Ja, unter „Meine Codes“. Bei festen Terminen geht das bis zur Stornofrist kurz vor Beginn, sie steht bei deinem Code. Angebote mit Zeitraum kannst du jederzeit stornieren, solange der Code nicht eingelöst ist. Dein Platz wird dann wieder frei.',
      },
      {
        q: 'Was passiert, wenn ich nicht hingehe?',
        a: 'Bei festen Terminen markiert der Anbieter dich dann als nicht erschienen. Passiert das öfter, kannst du für eine Weile keine Codes holen. Storniere deshalb lieber rechtzeitig, dann bekommt jemand anderes den Platz.',
      },
      {
        q: 'Wie viele Plätze kann ich sichern?',
        a: 'Pro Angebot hast du einen Code. Darin kannst du mehrere Plätze sichern, so viele, wie der Anbieter pro Person erlaubt.',
      },
      {
        q: 'In welchen Städten gibt es Angebote?',
        a: 'Wir starten in Münster. Die Stadt wechselst du oben in „Entdecken“. Neue Städte und Anbieter kommen nach und nach dazu.',
      },
      {
        q: 'Wie erfahre ich von neuen Angeboten?',
        a: 'Wähl im Profil aus, was dich interessiert, und schalte unter Einstellungen die Benachrichtigungen ein.',
      },
      {
        q: 'Wie lösche ich mein Konto?',
        a: 'Unter Profil → Einstellungen → Konto löschen. Aktive Codes werden dabei storniert, dein Name, dein Profilbild und deine Favoriten gelöscht.',
      },
      {
        q: 'Ich habe ein Unternehmen. Wie mache ich mit?',
        a: 'Registriere deinen Standort auf unserer Website für Unternehmen. Nach der Freischaltung stellst du dort deine Angebote ein.',
      },
    ],
  },
  contact: {
    title: 'Support kontaktieren',
    intro:
      'Frag uns, was du wissen willst, oder sag uns, was besser laufen könnte. Wir antworten dir per E-Mail.',
    messageLabel: 'Nachricht',
    placeholder: 'Worum geht es?',
    send: 'Senden',
    notYet:
      'Das Senden aus der App ist noch nicht freigeschaltet. Schreib uns bis dahin gern per E-Mail.',
    emailTitle: 'E-Mail',
    emailText: 'Du erreichst uns auch per E-Mail unter',
  },
  legal: {
    title: 'Rechtliches',
  },
};

export const profileEn: Widen<typeof profileDe> = {
  menu: {
    membership: 'Membership',
    help: 'Help & support',
    giftCard: 'Send a gift card',
    settings: 'Settings',
    legal: 'Legal',
  },
  invite: {
    title: 'Better together',
    text: 'Show the app to your friends and grab the next deals together.',
    button: 'Invite friends',
  },
  avatar: {
    title: 'Profile picture',
    change: 'Change profile picture',
    add: 'Add profile picture',
    library: 'Choose from library',
    camera: 'Take photo',
    remove: 'Remove profile picture',
    saving: 'Saving profile picture',
    hint: 'Only you can see your profile picture.',
    cameraDenied:
      "The app isn't allowed to use the camera. You can change this in your phone settings.",
    openSettings: 'Open phone settings',
  },
  settings: {
    title: 'Settings',
    deviceHint:
      'You allow location access and notifications in your phone settings. Tapping a row takes you there if the app is not allowed to ask itself.',
    language: 'Language',
    languageTitle: 'Choose language',
    notifications: 'Notifications',
    location: 'Location access',
    locationOn: 'On: offers near you',
    locationAsk: 'Off. Tap to allow it',
    locationDenied: 'Off. Change it in your phone settings',
    privacy: 'Privacy policy',
    version: (v) => `Version ${v}`,
    deleteAccount: 'Delete account',
  },
  membership: {
    title: 'Membership',
    planLabel: 'Your membership',
    plan: 'Free',
    planText: 'No subscription, no fees. You only pay the discounted price of the offer.',
    levelTitle: 'Your level',
    levelsTitle: 'All levels',
    reached: 'Reached',
    howText:
      'Every redeemed offer counts as an experience. Cancelled and missed dates do not count.',
    signInTitle: 'No account yet',
    signInText: 'Sign in to see your membership and your level here.',
  },
  giftCard: {
    title: 'Send a gift card',
    soonTitle: 'Gift cards are coming soon 🎁',
    soonText:
      "Soon you can give friends an experience in their city. We'll let you know when it starts.",
  },
  help: {
    title: 'Help & support',
    intro: 'Quick answers and a direct line to us.',
    faq: 'FAQ',
    faqHint: 'Codes, cancelling, account',
    contact: 'Contact support',
    contactHint: 'Send us a message',
    tour: 'How the app works',
    tourHint: 'Replay the tour',
  },
  faq: {
    title: 'FAQ',
    open: 'Show answer',
    close: 'Hide answer',
    items: [
      {
        q: 'What is unfair weekend?',
        a: 'Local businesses offer last-minute spots at a special price, for example cooking classes, yoga or culture. You grab a spot with a code and just go.',
      },
      {
        q: 'How do I get an offer?',
        a: 'Open the offer and tap “Get code”. The code then appears under “My codes”. You need an account with your first and last name so the business can find you on its guest list.',
      },
      {
        q: 'How do I redeem my code?',
        a: 'Show the QR code or the short code from “My codes” on site. For fixed dates this works from one hour before the start, for offers with a time span during that span.',
      },
      {
        q: 'Does the app cost anything?',
        a: 'No. There is no subscription and no fee. You only pay the discounted price of the offer.',
      },
      {
        q: 'Can I cancel a code?',
        a: 'Yes, under “My codes”. For fixed dates you can cancel until the deadline shortly before the start, shown with your code. Offers with a time span can be cancelled any time as long as the code has not been redeemed. Your spot becomes free again.',
      },
      {
        q: "What happens if I don't show up?",
        a: "For fixed dates the business marks you as a no-show. If that happens more often, you can't get codes for a while. So better cancel in time and someone else gets the spot.",
      },
      {
        q: 'How many spots can I get?',
        a: 'You have one code per offer. It can hold several spots, as many as the business allows per person.',
      },
      {
        q: 'Which cities have offers?',
        a: 'We are starting in Münster. You can switch the city at the top of “Discover”. New cities and businesses are added over time.',
      },
      {
        q: 'How do I hear about new offers?',
        a: 'Pick what you are into in your profile and turn on notifications under settings.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Go to Profile → Settings → Delete account. Active codes are cancelled and your name, profile picture and favourites are deleted.',
      },
      {
        q: 'I own a business. How can I join?',
        a: 'Register your location on our website for businesses. Once approved, you can post your offers there.',
      },
    ],
  },
  contact: {
    title: 'Contact support',
    intro: 'Ask us anything or tell us what could work better. We will reply by email.',
    messageLabel: 'Message',
    placeholder: 'What is it about?',
    send: 'Send',
    notYet: 'Sending from the app is not available yet. Until then, feel free to email us.',
    emailTitle: 'Email',
    emailText: 'You can also reach us by email at',
  },
  legal: {
    title: 'Legal',
  },
};
