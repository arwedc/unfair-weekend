import { DEFAULT_LOCALE, type Locale } from './locale';

/**
 * Die Zod-Schemas in `@repo/shared` liefern deutsche Meldungen. Damit die Schemas
 * selbst nicht pro Sprache dupliziert werden müssen, übersetzt `translateValidationMessage`
 * eine Meldung nachträglich. Unbekannte Texte bleiben unverändert (lieber Deutsch als leer).
 *
 * @example
 *   const parsed = schema.safeParse(input);
 *   if (!parsed.success) {
 *     const message = translateValidationMessage(parsed.error.issues[0]?.message ?? '', locale);
 *   }
 */
export function translateValidationMessage(
  message: string,
  locale: Locale = DEFAULT_LOCALE,
): string {
  if (locale === 'de') return message;

  const exact = EXACT_EN[message];
  if (exact) return exact;

  for (const [pattern, build] of PATTERNS_EN) {
    const match = pattern.exec(message);
    if (match) return build(match);
  }
  return message;
}

/** Feldnamen, die in parametrisierten Meldungen vorkommen (`${label} fehlt.`). */
export const FIELD_LABELS_EN: Record<string, string> = {
  Adresse: 'Address',
  Begründung: 'Reason',
  Beschreibung: 'Description',
  'Deal-Preis': 'Deal price',
  'Logo-Pfad': 'Logo path',
  Nachname: 'Last name',
  'Name der Vorlage': 'Template name',
  Originalpreis: 'Original price',
  Ort: 'City',
  Standortname: 'Venue name',
  'Straße und Hausnummer': 'Street and number',
  Telefon: 'Phone',
  Titel: 'Title',
  Unternehmensname: 'Company name',
  Vorname: 'First name',
  Website: 'Website',
};

const label = (de: string | undefined) => (de ? (FIELD_LABELS_EN[de] ?? de) : '');

const EXACT_EN: Record<string, string> = {
  'Bitte beide Koordinaten angeben oder keine.': 'Please enter both coordinates or none.',
  'Bitte die Art wählen.': 'Please choose the type.',
  'Bitte die Dauer angeben.': 'Please enter the duration.',
  'Bitte die Dauer in ganzen Minuten angeben.': 'Please enter the duration in whole minutes.',
  'Bitte ein gültiges Ende angeben.': 'Please enter a valid end.',
  'Bitte eine Kategorie wählen.': 'Please choose a category.',
  'Bitte einen Code eingeben oder scannen.': 'Please enter or scan a code.',
  'Bitte einen gültigen Beginn angeben.': 'Please enter a valid start.',
  'Bitte gib den Code aus der E-Mail ein.': 'Please enter the code from the email.',
  'Bitte gib ein gültiges Alter an.': 'Please enter a valid age.',
  'Bitte gib eine gültige E-Mail-Adresse an.': 'Please enter a valid email address.',
  'Bitte mindestens einen Platz wählen.': 'Please choose at least one spot.',
  'Das Alter darf höchstens 120 sein.': 'Age can be at most 120.',
  'Das Alter muss eine ganze Zahl sein.': 'Age must be a whole number.',
  'Das Alter muss mindestens 1 sein.': 'Age must be at least 1.',
  'Das Passwort braucht mindestens 8 Zeichen.': 'The password needs at least 8 characters.',
  'Das Passwort darf höchstens 72 Zeichen haben.': 'The password can have at most 72 characters.',
  'Der Nutzername braucht 3–20 Zeichen: Kleinbuchstaben, Zahlen oder Unterstriche.':
    'The username needs 3–20 characters: lowercase letters, numbers or underscores.',
  'Der Originalpreis muss größer als 0 sein.': 'The original price must be greater than 0.',
  'Die Postleitzahl muss 5 Ziffern haben.': 'The postcode must have 5 digits.',
  'Die Provision darf höchstens 50 % betragen.': 'The commission can be at most 50%.',
  'Die Provision kann nicht negativ sein.': 'The commission cannot be negative.',
  'Eine Kategorie kann nur einmal ausgewählt werden.': 'Each category can only be selected once.',
  'Mindestens 1 Platz pro Person.': 'At least 1 spot per person.',
  'Mindestens 1 Platz.': 'At least 1 spot.',
  'Das Ende muss nach dem Beginn liegen.': 'The end must be after the start.',
  'Der Deal-Preis muss unter dem Originalpreis liegen.':
    'The deal price must be below the original price.',
  'Der Zeitpunkt liegt in der Vergangenheit.': 'This time is in the past.',
  'Plätze pro Person dürfen das Kontingent nicht übersteigen.':
    'Spots per person cannot exceed the total number of spots.',
};

const PATTERNS_EN: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(.+) fehlt\.$/, (m) => `${label(m[1])} is missing.`],
  [/^(.+) darf nicht negativ sein\.$/, (m) => `${label(m[1])} cannot be negative.`],
  [
    /^(.+) muss in ganzen Cent angegeben werden\.$/,
    (m) => `${label(m[1])} must be given in whole cents.`,
  ],
  [/^(.+): höchstens (\d+) Zeichen\.$/, (m) => `${label(m[1])}: at most ${m[2]} characters.`],
  [/^(.+): mindestens (\d+) Zeichen\.$/, (m) => `${label(m[1])}: at least ${m[2]} characters.`],
  [/^Höchstens (\d+) Plätze pro Person\.$/, (m) => `At most ${m[1]} spots per person.`],
  [/^Höchstens (\d+) Plätze\.$/, (m) => `At most ${m[1]} spots.`],
  [/^Höchstens (\d+) Bilder\.$/, (m) => `At most ${m[1]} images.`],
  [/^Höchstens (\d+) Tage Dauer\.$/, (m) => `At most ${m[1]} days long.`],
  [
    /^Der Rabatt muss mindestens (\d+) % betragen\.$/,
    (m) => `The discount must be at least ${m[1]}%.`,
  ],
];
