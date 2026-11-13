/** Eigener Standort über expo-location. Läuft auch in Expo Go. */
import * as Location from 'expo-location';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type PositionResult =
  { status: 'ok'; coords: Coordinates } | { status: 'denied' } | { status: 'failed' };

/** Eine Position gilt so lange als „schnell genug“ für den Sprung zum Standort. */
const QUICK_MAX_AGE_MS = 10 * 60_000;

/** Zuletzt bekannte Position dieser App-Sitzung (z. B. vom App-Start), für sofortige Sprünge. */
let remembered: { coords: Coordinates; at: number } | null = null;

function remember(position: Location.LocationObject): Coordinates {
  const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
  remembered = { coords, at: Date.now() };
  return coords;
}

/** Erlaubnis: nur fragen, wenn noch nicht entschieden (das Nachschauen ist schneller). */
async function hasPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/** Frische Ortung. „Balanced“ reicht für Stadt und Karte und ist deutlich schneller als „High“. */
async function freshPosition(): Promise<Coordinates> {
  return remember(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
}

/**
 * Standort so schnell wie möglich: erst die gemerkte Position, dann die letzte bekannte des
 * Geräts, erst zuletzt eine frische Ortung. `refined` liefert danach (falls es eine schnelle
 * Antwort gab) die frische Position nach, damit der Punkt genau sitzt.
 */
export async function quickPosition(): Promise<
  PositionResult & { refined?: Promise<Coordinates | null> }
> {
  try {
    if (!(await hasPermission())) return { status: 'denied' };

    const refine = () => freshPosition().catch(() => null);

    if (remembered && Date.now() - remembered.at < QUICK_MAX_AGE_MS) {
      return { status: 'ok', coords: remembered.coords, refined: refine() };
    }
    const last = await Location.getLastKnownPositionAsync({ maxAge: QUICK_MAX_AGE_MS });
    if (last) return { status: 'ok', coords: remember(last), refined: refine() };

    return { status: 'ok', coords: await freshPosition() };
  } catch {
    return { status: 'failed' };
  }
}

/** Standort ohne Nachlieferung, z. B. für die Stadtwahl beim App-Start. */
export async function currentPosition(): Promise<PositionResult> {
  const result = await quickPosition();
  return result.status === 'ok' ? { status: 'ok', coords: result.coords } : result;
}
