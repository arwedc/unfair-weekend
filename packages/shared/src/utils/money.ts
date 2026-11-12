/**
 * Preise und Rabatte. Alle Beträge sind ganze Cent (EUR).
 *
 * Die Formatierung ist bewusst selbst gebaut statt `Intl.NumberFormat`:
 * So sieht sie auf iOS, Android, im Browser und in Node exakt gleich aus.
 */

const NBSP = ' ';
const MINUS = '−';

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} muss eine ganze Zahl ≥ 0 (Cent) sein, erhalten: ${value}`);
  }
}

function assertPercent(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new RangeError(
      `${name} muss eine ganze Zahl zwischen 0 und 100 sein, erhalten: ${value}`,
    );
  }
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface FormatPriceOptions {
  /** „24 €“ statt „24,00 €“, wenn keine Cent anfallen. */
  omitZeroCents?: boolean;
}

/**
 * Formatiert Cent als Euro-Betrag.
 * @example formatPrice(2450) // "24,50 €"
 * @example formatPrice(2400, { omitZeroCents: true }) // "24 €"
 */
export function formatPrice(cents: number, options: FormatPriceOptions = {}): string {
  assertCents(cents, 'cents');
  const euros = groupThousands(String(Math.floor(cents / 100)));
  const rest = cents % 100;
  if (options.omitZeroCents && rest === 0) {
    return `${euros}${NBSP}€`;
  }
  return `${euros},${String(rest).padStart(2, '0')}${NBSP}€`;
}

/**
 * Rabatt in ganzen Prozent, abgerundet (wir übertreiben nie).
 * @example discountPercent(4000, 2400) // 40
 */
export function discountPercent(originalCents: number, dealCents: number): number {
  assertCents(originalCents, 'originalCents');
  assertCents(dealCents, 'dealCents');
  if (originalCents === 0 || dealCents >= originalCents) {
    return 0;
  }
  return Math.floor(((originalCents - dealCents) * 100) / originalCents);
}

/**
 * Prüft den Mindestrabatt mit derselben Ganzzahl-Regel wie der Server:
 * (Original − Deal) × 100 ≥ Mindestrabatt × Original, und Deal < Original.
 */
export function meetsMinDiscount(
  originalCents: number,
  dealCents: number,
  minDiscountPercent: number,
): boolean {
  assertCents(originalCents, 'originalCents');
  assertCents(dealCents, 'dealCents');
  assertPercent(minDiscountPercent, 'minDiscountPercent');
  return (
    dealCents < originalCents &&
    (originalCents - dealCents) * 100 >= minDiscountPercent * originalCents
  );
}

/**
 * Höchster Deal-Preis, der den Mindestrabatt noch erfüllt (für Formular-Hinweise).
 * @example maxDealPriceCents(4000, 20) // 3200
 */
export function maxDealPriceCents(originalCents: number, minDiscountPercent: number): number {
  assertCents(originalCents, 'originalCents');
  assertPercent(minDiscountPercent, 'minDiscountPercent');
  const max = Math.floor((originalCents * (100 - minDiscountPercent)) / 100);
  return Math.min(max, Math.max(originalCents - 1, 0));
}

/**
 * Rabatt für Badges.
 * @example formatDiscount(40) // "−40 %"
 */
export function formatDiscount(percent: number): string {
  return `${MINUS}${percent}${NBSP}%`;
}
