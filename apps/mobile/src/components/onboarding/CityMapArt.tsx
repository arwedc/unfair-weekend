import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

import { colors, fun } from '@/theme';

const ROAD = colors.surface.raised;
const WATER = fun.sky.bg;
const GREEN = fun.mint.bg;
const BLOCK = colors.border.subtle;

/**
 * Gezeichnete Stadtkarte fürs Onboarding: See, Fluss, grüner Ring um die Altstadt,
 * Hauptstraßen. Flach und ruhig, damit die Foto-Pins darauf leuchten.
 * Sie füllt ihre Fläche ganz aus (wird zugeschnitten, nicht verzerrt).
 */
export const CityMapArt = memo(function CityMapArt() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 400 400"
      preserveAspectRatio="xMidYMid slice"
      accessible={false}
    >
      <Rect x={0} y={0} width={400} height={400} fill={colors.background.muted} />

      {/* Parks */}
      <Path
        d="M300 40 C340 30 390 60 392 110 C394 150 350 160 320 140 C292 122 270 60 300 40 Z"
        fill={GREEN}
      />
      <Path
        d="M20 300 C50 280 90 300 96 330 C102 362 60 392 30 380 C6 370 -4 318 20 300 Z"
        fill={GREEN}
      />

      {/* See und Fluss */}
      <Ellipse cx={92} cy={262} rx={58} ry={24} rotation={-38} origin="92, 262" fill={WATER} />
      <Path
        d="M120 228 C150 196 150 160 176 132 C204 102 250 96 278 70 C298 52 306 26 330 -10"
        stroke={WATER}
        strokeWidth={14}
        strokeLinecap="round"
        fill="none"
      />

      {/* Grüner Ring um die Altstadt */}
      <Circle cx={214} cy={196} r={80} stroke={GREEN} strokeWidth={16} fill="none" />

      {/* Häuserblöcke in der Altstadt */}
      <G fill={BLOCK}>
        <Rect x={170} y={150} width={30} height={22} rx={5} />
        <Rect x={208} y={146} width={36} height={26} rx={5} />
        <Rect x={176} y={206} width={28} height={30} rx={5} />
        <Rect x={226} y={212} width={34} height={24} rx={5} />
        <Rect x={250} y={170} width={18} height={30} rx={5} />
      </G>

      {/* Hauptstraßen */}
      <G stroke={ROAD} strokeLinecap="round" fill="none">
        <Path d="M-10 120 C80 140 150 170 214 196 C290 226 340 250 410 300" strokeWidth={10} />
        <Path d="M60 -10 C90 80 150 150 214 196 C260 230 270 320 250 410" strokeWidth={10} />
        <Path d="M-10 380 C90 330 160 300 214 276" strokeWidth={8} />
        <Path d="M410 150 C340 160 300 180 294 196" strokeWidth={8} />
        <Circle cx={214} cy={196} r={62} strokeWidth={5} />
        <Path d="M130 40 L176 120" strokeWidth={4} />
        <Path d="M330 330 L294 252" strokeWidth={4} />
        <Path d="M30 200 L134 186" strokeWidth={4} />
        <Path d="M300 400 L340 300 L400 268" strokeWidth={4} />
      </G>
    </Svg>
  );
});
