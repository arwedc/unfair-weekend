import { STORAGE_BUCKETS, storageImageUrl, type StorageBucket } from '@repo/shared';
import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import { env } from '@/lib/env';
import { colors, duration } from '@/theme';

export interface OfferImageProps {
  /** Pfad im Bucket oder eine vollständige URL. */
  path: string | null | undefined;
  /** Standard: Angebotsbilder. Für Firmenlogos `STORAGE_BUCKETS.companyLogos`. */
  bucket?: StorageBucket;
  style?: StyleProp<ImageStyle>;
  /** Für Screenreader, z. B. der Titel des Angebots. Ohne Angabe gilt das Bild als Deko. */
  accessibilityLabel?: string;
  /** Wichtige Bilder (oben im Feed) zuerst laden. */
  priority?: 'low' | 'normal' | 'high';
  contentFit?: 'cover' | 'contain';
}

/** Foto aus dem Supabase-Storage mit sanftem Einblenden und grauem Platzhalter. */
export function OfferImage({
  path,
  bucket = STORAGE_BUCKETS.offerImages,
  style,
  accessibilityLabel,
  priority = 'normal',
  contentFit = 'cover',
}: OfferImageProps) {
  return (
    <Image
      source={path ? { uri: storageImageUrl(env.supabaseUrl, bucket, path) } : null}
      style={[{ backgroundColor: colors.background.muted }, style]}
      contentFit={contentFit}
      transition={duration.base}
      priority={priority}
      recyclingKey={path ?? undefined}
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
