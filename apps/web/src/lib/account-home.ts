/** Antwort von `get_my_account()`, soweit sie fürs Routing gebraucht wird. */
export interface AccountRouting {
  role?: string;
  location?: { status?: string } | null;
}

/**
 * Startseite je nach Konto. Admins in den Admin-Bereich; Standorte je nach Stand der
 * Registrierung (Unternehmen fehlt → `/registrieren`, noch nicht freigeschaltet → `/antrag`).
 * `null` heißt: Das Konto gehört nicht auf die Website (z. B. ein Nutzerkonto der App).
 */
export function accountHome(account: AccountRouting | null | undefined): string | null {
  if (account?.role === 'admin') return '/admin/zahlungen';
  if (account?.role !== 'standort') return null;
  if (!account.location) return '/registrieren';
  return account.location.status === 'approved' ? '/angebote' : '/antrag';
}
