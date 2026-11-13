/** Öffnet Ziele außerhalb der App: Karten-App, Telefon, Webseiten. */
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Öffnet die Adresse in der Karten-App des Geräts. */
export async function openInMaps(target: {
  label: string;
  address: string;
  lat: number | null;
  lng: number | null;
}): Promise<void> {
  const query = encodeURIComponent(target.address || target.label);
  const hasCoords = target.lat !== null && target.lng !== null;
  const coords = hasCoords ? `${target.lat},${target.lng}` : null;

  const native = Platform.select({
    ios: `http://maps.apple.com/?q=${query}${coords ? `&ll=${coords}` : ''}`,
    android: `geo:${coords ?? '0,0'}?q=${query}`,
    default: null,
  });
  if (native && (await tryOpen(native))) return;

  // Rückfall ohne Karten-App: OpenStreetMap im Browser.
  await tryOpen(`https://www.openstreetmap.org/search?query=${query}`);
}

export async function callPhone(phone: string): Promise<void> {
  await tryOpen(`tel:${phone.replace(/[^\d+]/g, '')}`);
}

/** Webseite im In-App-Browser. Ergänzt https://, falls es fehlt. */
export async function openWebsite(url: string): Promise<void> {
  const full = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    await WebBrowser.openBrowserAsync(full);
  } catch {
    await tryOpen(full);
  }
}
