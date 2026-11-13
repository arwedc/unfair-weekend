/**
 * „Entdecken“ startet in der Stadt, in der man gerade ist.
 * Einmal pro App-Start: Standort holen und die nächstgelegene Stadt wählen. Danach kann
 * man die Stadt von Hand wechseln; das gilt, bis man auf der Karte „Mein Standort“ tippt.
 * Ohne Erlaubnis bleibt die zuletzt gewählte (gespeicherte) Stadt.
 */
import { useEffect } from 'react';

import { currentPosition } from '@/lib/location';

import { nearestCityId } from './cities';
import { useOfferFilters } from './filters-context';

let detectedThisLaunch = false;

export function useCityFromLocation(): void {
  const { setCityId } = useOfferFilters();

  useEffect(() => {
    if (detectedThisLaunch) return;
    detectedThisLaunch = true;
    void currentPosition().then((result) => {
      if (result.status === 'ok') setCityId(nearestCityId(result.coords));
    });
  }, [setCityId]);
}
