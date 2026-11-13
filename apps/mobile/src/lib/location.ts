/** Eigener Standort über expo-location. Läuft auch in Expo Go. */
import * as Location from 'expo-location';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type PositionResult =
  { status: 'ok'; coords: Coordinates } | { status: 'denied' } | { status: 'failed' };

/**
 * Holt den Standort. Fragt nach der Erlaubnis, falls noch nicht entschieden; eine
 * abgelehnte Erlaubnis fragt das System nicht erneut ab (dann `denied`).
 * Zuerst die letzte bekannte Position (schnell), sonst eine frische (ungefähr reicht).
 */
export async function currentPosition(): Promise<PositionResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const position =
      (await Location.getLastKnownPositionAsync()) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return {
      status: 'ok',
      coords: { lat: position.coords.latitude, lng: position.coords.longitude },
    };
  } catch {
    return { status: 'failed' };
  }
}
