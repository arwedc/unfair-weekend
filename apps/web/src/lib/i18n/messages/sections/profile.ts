import type { Widen } from '../widen';

export const profileDe = {
  title: 'Unternehmensprofil',
  intro: 'Name, Logo und Beschreibung gelten für alle Standorte deines Unternehmens.',
  loading: 'Profil wird geladen …',
  notFound: 'Dein Unternehmen wurde nicht gefunden.',
  saved: 'Profil gespeichert.',
  name: 'Name des Unternehmens',
  nameHint: 'So erscheint ihr in der App bei allen Angeboten.',
  description: 'Beschreibung',
  descriptionHint: (length: number, max: number) =>
    `Wer seid ihr, was macht euch aus? ${length} / ${max} Zeichen.`,
  logo: {
    label: 'Logo',
    alt: (name: string) => `Logo von ${name}`,
    onlyTypes: 'Nur JPEG, PNG oder WebP.',
    tooLarge: 'Das Logo darf höchstens 2 MB groß sein.',
    uploadFailed: 'Hochladen hat nicht geklappt. Bitte erneut versuchen.',
    uploading: 'Lädt hoch …',
    change: 'Anderes Logo wählen',
    upload: 'Logo hochladen',
    remove: 'Logo entfernen',
    pending: 'Wird mit „Änderungen speichern“ übernommen.',
    hint: 'Quadratisch wirkt am besten. JPEG, PNG oder WebP, höchstens 2 MB.',
    reupload: 'Bitte das Logo erneut hochladen.',
  },
};

export const profileEn: Widen<typeof profileDe> = {
  title: 'Company profile',
  intro: 'Name, logo and description apply to all venues of your company.',
  loading: 'Loading profile …',
  notFound: 'Your company could not be found.',
  saved: 'Profile saved.',
  name: 'Company name',
  nameHint: 'This is how you appear in the app on all offers.',
  description: 'Description',
  descriptionHint: (length, max) =>
    `Who are you, what makes you special? ${length} / ${max} characters.`,
  logo: {
    label: 'Logo',
    alt: (name) => `Logo of ${name}`,
    onlyTypes: 'Only JPEG, PNG or WebP.',
    tooLarge: 'The logo can be at most 2 MB.',
    uploadFailed: 'Upload did not work. Please try again.',
    uploading: 'Uploading …',
    change: 'Choose another logo',
    upload: 'Upload logo',
    remove: 'Remove logo',
    pending: 'Will be applied with “Save changes”.',
    hint: 'Square works best. JPEG, PNG or WebP, at most 2 MB.',
    reupload: 'Please upload the logo again.',
  },
};
