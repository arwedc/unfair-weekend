/**
 * Merkt sich pro Konto auf diesem Gerät, wie viele Stempel die Person schon gesehen hat.
 * Daraus ergeben sich die frischen Stempel (landen mit Animation) und der Level-up-Moment.
 * Nur Komfort: Ist der Speicher leer (neues Gerät, neu installiert), wird nichts
 * nachträglich gefeiert, der aktuelle Stand gilt dann einfach als gesehen.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

const storageKey = (userId: string) => `profile.stamps-seen.${userId}`;

/**
 * Wie viele Stempel beim letzten Besuch schon da waren (null, solange das lädt).
 * Sobald der Screen sichtbar ist, gilt der aktuelle Stand als gesehen und wird gespeichert;
 * der zurückgegebene Wert bleibt bis zum nächsten Besuch beim alten Stand, damit die
 * Animation zu Ende laufen kann.
 */
export function useSeenStamps(userId: string | null, count: number | null): number | null {
  const focused = useIsFocused();
  const [seen, setSeen] = useState<{ userId: string; count: number } | null>(null);

  useEffect(() => {
    if (userId === null || count === null || !focused) return;
    let active = true;
    const key = storageKey(userId);
    void AsyncStorage.getItem(key)
      .catch(() => null)
      .then((raw) => {
        if (!active) return;
        const stored = raw === null ? count : Number(raw);
        setSeen({ userId, count: Number.isFinite(stored) ? Math.min(stored, count) : count });
        void AsyncStorage.setItem(key, String(count)).catch(() => undefined);
      });
    return () => {
      active = false;
    };
  }, [userId, count, focused]);

  return seen !== null && seen.userId === userId ? seen.count : null;
}
