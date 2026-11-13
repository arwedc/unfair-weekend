import type { Widen } from '../widen';

export const templatesDe = {
  title: 'Vorlagen',
  intro:
    'Für Angebote, die du immer wieder machst. Aus einer Vorlage wird in Sekunden ein Angebot.',
  newTemplate: 'Neue Vorlage',
  editTitle: 'Vorlage bearbeiten',
  backToTemplates: '← Zurück zu den Vorlagen',
  listLoading: 'Vorlagen werden geladen …',
  detailLoading: 'Vorlage wird geladen …',
  saved: 'Vorlage gespeichert.',
  deleted: 'Vorlage gelöscht.',
  emptyTitle: 'Noch keine Vorlagen',
  emptyText:
    'Leg für Angebote, die du öfter machst, eine Vorlage an. Fällt kurzfristig etwas aus, wählst du nur noch den Beginn und das Angebot ist live.',
  count: (n: number, max: number) => `${n} von ${max} Vorlagen`,
  seats: (n: number) => `${n} Plätze`,
  edit: 'Bearbeiten',
  editAria: (name: string) => `Vorlage „${name}“ bearbeiten`,
  createOffer: 'Angebot erstellen',
  createOfferAria: (name: string) => `Angebot aus Vorlage „${name}“ erstellen`,
  label: 'Vorlage',
  notApproved:
    'Dein Standort ist noch nicht freigeschaltet. Sobald wir ihn geprüft haben, kannst du hier Vorlagen anlegen.',
  prefilledFrom: (title: string) =>
    `Vorausgefüllt mit den Angaben aus „${title}“. Gib der Vorlage noch einen Namen.`,
  form: {
    sectionTemplate: 'Vorlage',
    name: 'Name der Vorlage',
    nameHint: 'Nur für dich sichtbar, z. B. „Kochkurs Standard“ oder „Mittagstisch“.',
    sectionWhat: 'Worum geht es?',
    titleHint: 'So heißt das Angebot später in der App.',
    sectionDuration: 'Art und Dauer',
    durationSingle: 'Dauer des Termins',
    durationPeriod: 'Einlösbar für',
    durationHint: (days: number) =>
      `Den Beginn wählst du erst beim Anlegen des Angebots. Höchstens ${days} Tage.`,
    durationUnit: 'Einheit der Dauer',
    sectionPrice: 'Preis und Plätze',
    save: 'Vorlage speichern',
  },
  validation: {
    duration: 'Bitte die Dauer als ganze Zahl angeben.',
  },
  delete: {
    title: 'Vorlage löschen',
    text: 'Angebote, die du aus dieser Vorlage erstellt hast, bleiben unverändert.',
    open: 'Vorlage löschen …',
    confirm: 'Endgültig löschen',
    confirming: 'Wird gelöscht …',
    failed: 'Löschen hat nicht geklappt.',
  },
};

export const templatesEn: Widen<typeof templatesDe> = {
  title: 'Templates',
  intro: 'For offers you run again and again. A template turns into an offer in seconds.',
  newTemplate: 'New template',
  editTitle: 'Edit template',
  backToTemplates: '← Back to templates',
  listLoading: 'Loading templates …',
  detailLoading: 'Loading template …',
  saved: 'Template saved.',
  deleted: 'Template deleted.',
  emptyTitle: 'No templates yet',
  emptyText:
    'Create a template for offers you run often. When something falls through at short notice, you only pick the start and the offer is live.',
  count: (n, max) => `${n} of ${max} templates`,
  seats: (n) => `${n} ${n === 1 ? 'spot' : 'spots'}`,
  edit: 'Edit',
  editAria: (name) => `Edit template “${name}”`,
  createOffer: 'Create offer',
  createOfferAria: (name) => `Create offer from template “${name}”`,
  label: 'Template',
  notApproved:
    'Your venue has not been approved yet. Once we have reviewed it, you can create templates here.',
  prefilledFrom: (title) => `Prefilled with the details from “${title}”. Give the template a name.`,
  form: {
    sectionTemplate: 'Template',
    name: 'Template name',
    nameHint: 'Only visible to you, e.g. “Standard cooking class” or “Lunch special”.',
    sectionWhat: 'What is it about?',
    titleHint: 'This is what the offer will be called in the app.',
    sectionDuration: 'Type and duration',
    durationSingle: 'Duration of the session',
    durationPeriod: 'Redeemable for',
    durationHint: (days) =>
      `You choose the start only when creating the offer. At most ${days} days.`,
    durationUnit: 'Duration unit',
    sectionPrice: 'Price and spots',
    save: 'Save template',
  },
  validation: {
    duration: 'Please enter the duration as a whole number.',
  },
  delete: {
    title: 'Delete template',
    text: 'Offers you created from this template stay unchanged.',
    open: 'Delete template …',
    confirm: 'Delete permanently',
    confirming: 'Deleting …',
    failed: 'Deleting did not work.',
  },
};
