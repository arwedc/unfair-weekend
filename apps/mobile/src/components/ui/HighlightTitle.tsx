import type { ReactNode } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radii, soft, space, type TextStyleName } from '@/theme';

import { Text } from './Text';

export interface HighlightTitleProps {
  children: ReactNode;
  variant?: TextStyleName;
}

interface MarkerLine {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Überschrift mit weichem Marker-Strich dahinter (zartes Apricot, leicht versetzt).
 * Der Strich liegt hinter der unteren Texthälfte und ragt etwas über die Ränder.
 */
export function HighlightTitle({ children, variant = 'title3' }: HighlightTitleProps) {
  const [lines, setLines] = useState<MarkerLine[]>([]);

  return (
    <View style={styles.wrap}>
      {lines.map((line, index) => {
        const markerHeight = line.height * 0.42;

        return (
          <View
            key={index}
            style={[
              styles.marker,
              {
                left: line.x,
                width: line.width,
                top: line.y + line.height - space[0.5] - markerHeight,
                height: markerHeight,
              },
            ]}
          />
        );
      })}
      <Text
        variant={variant}
        accessibilityRole="header"
        onTextLayout={({ nativeEvent }) => {
          const nextLines = nativeEvent.lines
            .filter(({ width }) => width > 0)
            .map(({ height, width, x, y }) => ({ height, width, x, y }));

          setLines((currentLines) => {
            const unchanged =
              currentLines.length === nextLines.length &&
              currentLines.every((line, index) => {
                const nextLine = nextLines[index];
                return (
                  nextLine !== undefined &&
                  line.height === nextLine.height &&
                  line.width === nextLine.width &&
                  line.x === nextLine.x &&
                  line.y === nextLine.y
                );
              });

            return unchanged ? currentLines : nextLines;
          });
        }}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', flexShrink: 1 },
  marker: {
    position: 'absolute',
    borderRadius: radii.xs,
    backgroundColor: soft.tint,
    transform: [{ rotate: '-1deg' }],
  },
});
