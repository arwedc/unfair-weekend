/** Reine Logik für die Standortseite. */

/** Klein, ohne Akzente, Leerzeichen und Satzzeichen: „Theatre, Music“ → „theatremusic“. */
function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * Standortname als Untertitel unter dem Firmennamen, aber nur, wenn er etwas Neues sagt.
 * Leer, gleich oder schon im Firmennamen enthalten (z. B. „Museum X“ unter „Lithuanian Museum X“) → null.
 * Ergänzt er den Firmennamen („Café Ü – Hafen“ unter „Café Ü“), bleibt er stehen.
 */
export function distinctSubtitle(companyName: string, locationName: string): string | null {
  const subtitle = locationName.trim();
  const location = normalizeName(subtitle);
  if (!location || normalizeName(companyName).includes(location)) return null;
  return subtitle;
}
