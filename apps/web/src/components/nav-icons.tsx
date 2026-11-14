import type { ReactNode } from 'react';

/** Kleine Strich-Icons für die Navigation. Farbe kommt über currentColor aus dem Text. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-[18px] w-[18px] shrink-0"
    >
      {children}
    </svg>
  );
}

/** Angebote: Preisschild */
export function OffersIcon() {
  return (
    <Icon>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </Icon>
  );
}

/** Einlösen: Ticket mit Haken */
export function CheckinIcon() {
  return (
    <Icon>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

/** Vorlagen: zwei gestapelte Blätter */
export function TemplatesIcon() {
  return (
    <Icon>
      <rect x="8" y="8" width="12" height="13" rx="2" />
      <path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" />
    </Icon>
  );
}

/** Bewertungen: Stern */
export function ReviewsIcon() {
  return (
    <Icon>
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3l-5.5 2.9 1-6.2L3 9.6l6.2-.9Z" />
    </Icon>
  );
}

/** Auszahlungen: Geldschein */
export function PayoutsIcon() {
  return (
    <Icon>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </Icon>
  );
}

/** Profil: Laden mit Markise */
export function ProfileIcon() {
  return (
    <Icon>
      <path d="M4 10v10h16V10" />
      <path d="M3 4h18l-1 6a3 3 0 0 1-5.3 0 3 3 0 0 1-5.4 0A3 3 0 0 1 4 10Z" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  );
}

/** Abmelden: Pfeil aus der Tür */
export function LogoutIcon() {
  return (
    <Icon>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5M21 12H9" />
    </Icon>
  );
}
