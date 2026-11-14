/**
 * Die Karten-Seite der App mit unseren Farben. Einmal gebaut und von Karte-Tab und
 * Abschnitts-Seite gemeinsam genutzt, damit beide gleich aussehen.
 */
import { env } from '@/lib/env';
import { colors } from '@/theme';

import { buildMapHtml, MAP_PALETTE } from './map-html';

export const APP_MAP_HTML = buildMapHtml({
  styleUrl: env.mapStyleUrl,
  colors: {
    pin: colors.accent.solid,
    pinDot: colors.accent.onSolid,
    // Gewählte Nadel: kräftigeres Orange-Gold (gold[500]), etwas größer. Eigener Standort: blauer Punkt.
    pinActive: colors.accent.solidPressed,
    pinActiveDot: colors.accent.onSolid,
    user: MAP_PALETTE.userLocation,
    background: colors.background.muted,
  },
});
