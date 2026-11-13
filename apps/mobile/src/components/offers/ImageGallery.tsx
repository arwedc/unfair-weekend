import { useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { colors, radii, space } from '@/theme';

import { OfferImage } from './OfferImage';

export interface ImageGalleryProps {
  paths: readonly string[];
  /** Für Screenreader: wozu die Bilder gehören. */
  title: string;
  width?: number;
  labels: {
    gallery: (title: string) => string;
    image: (position: number, total: number) => string;
    singleImage: (title: string) => string;
  };
}

/** Bildergalerie über die volle Breite, zum Wischen, mit Punkten als Positionsanzeige. */
export function ImageGallery({ paths, title, width: contentWidth, labels }: ImageGalleryProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = contentWidth ?? windowWidth;
  const [index, setIndex] = useState(0);
  const height = Math.round(width * 0.82);
  const images = paths.length > 0 ? paths : [null];

  return (
    <View style={{ height }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={images.length > 1}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
        accessibilityLabel={labels.gallery(title)}
      >
        {images.map((path, position) => (
          <OfferImage
            key={path ?? 'leer'}
            path={path}
            priority={position === 0 ? 'high' : 'low'}
            style={{ width, height }}
            accessibilityLabel={
              images.length > 1
                ? labels.image(position + 1, images.length)
                : labels.singleImage(title)
            }
          />
        ))}
      </ScrollView>

      {images.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {images.map((path, position) => (
            <View
              key={path ?? 'leer'}
              style={[styles.dot, position === index && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: space[3],
    alignSelf: 'center',
    flexDirection: 'row',
    gap: space[1.5],
    paddingHorizontal: space[2],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.surface.overlay,
  },
  dot: { width: 6, height: 6, borderRadius: radii.full, backgroundColor: colors.text.disabled },
  dotActive: { width: 16, backgroundColor: colors.text.inverse },
});
