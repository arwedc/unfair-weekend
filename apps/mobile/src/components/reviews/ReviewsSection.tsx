import { MessageSquareText } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Skeleton, Text } from '@/components/ui';
import type { LocationReview } from '@/features/reviews/api';
import { useLocationRating, useLocationReviews } from '@/features/reviews/queries';
import { formatRating, reviewCountLabel, reviewDateLabel } from '@/features/reviews/review-logic';
import { colors, fonts, radii, soft, space } from '@/theme';

import { Stars } from './Stars';

/** So viele Bewertungen stehen sofort da, der Rest hinter „Alle Bewertungen“. */
const PREVIEW_COUNT = 3;

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function ReviewItem({ review, last }: { review: LocationReview; last: boolean }) {
  return (
    <View style={[styles.item, !last && styles.itemDivider]}>
      <View style={styles.author}>
        <View style={styles.avatar}>
          <Text variant="headline" style={styles.avatarLetter}>
            {initial(review.author_name)}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text variant="bodyStrong">{review.author_name}</Text>
          <Text variant="footnote" color="tertiary" numberOfLines={1}>
            {review.offer_title}
          </Text>
        </View>
      </View>
      <View style={styles.meta}>
        <Stars value={review.rating} size={14} />
        <Text variant="footnote" color="tertiary">
          · {reviewDateLabel(review.created_at)}
        </Text>
      </View>
      {review.comment ? (
        <Text variant="body" color="secondary">
          {review.comment}
        </Text>
      ) : null}
    </View>
  );
}

export interface ReviewsSectionProps {
  locationId: string;
  /** Für den Leerzustand, z. B. „Kochwerk Altstadt“. */
  locationName: string;
}

/**
 * „Bewertungen & Rezensionen“: großer Durchschnitt mit Sternen, die neuesten Bewertungen
 * und „Alle Bewertungen“. Ohne Bewertungen ein freundlicher Hinweis, wie man bewertet.
 */
export function ReviewsSection({ locationId, locationName }: ReviewsSectionProps) {
  const rating = useLocationRating(locationId);
  const reviews = useLocationReviews(locationId);
  const [showAll, setShowAll] = useState(false);

  const items = reviews.data ?? [];
  const visible = showAll ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <View style={styles.section}>
      <Text variant="title3" accessibilityRole="header">
        Bewertungen & Rezensionen
      </Text>

      {rating.isPending || reviews.isPending ? (
        <View style={styles.loading}>
          <Skeleton width="45%" height={44} />
          <Skeleton height={88} />
        </View>
      ) : rating.data ? (
        <>
          <View style={styles.summary}>
            <Text style={styles.average}>{formatRating(rating.data.average_rating)}</Text>
            <View style={styles.summaryText}>
              <Stars value={rating.data.average_rating} size={22} />
              <Text variant="footnote" color="secondary">
                {reviewCountLabel(rating.data.review_count)}
              </Text>
            </View>
          </View>

          <View>
            {visible.map((review, index) => (
              <ReviewItem key={review.id} review={review} last={index === visible.length - 1} />
            ))}
          </View>

          {items.length > PREVIEW_COUNT ? (
            <Button
              label={showAll ? 'Weniger anzeigen' : 'Alle Bewertungen'}
              variant="secondary"
              fullWidth
              onPress={() => setShowAll((value) => !value)}
            />
          ) : null}
        </>
      ) : (
        <View style={styles.empty}>
          <MessageSquareText size={22} strokeWidth={2} color={colors.text.tertiary} />
          <Text variant="callout" color="secondary" style={styles.flex}>
            {locationName} hat noch keine Bewertungen. Nach deinem Besuch kannst du den Ort unter
            „Meine Codes“ bewerten.
          </Text>
        </View>
      )}
    </View>
  );
}

const AVATAR_SIZE = space[10];

const styles = StyleSheet.create({
  section: { gap: space[4] },
  flex: { flex: 1 },
  loading: { gap: space[3] },
  summary: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  average: {
    fontFamily: fonts.extrabold,
    fontSize: space[12],
    lineHeight: space[12] + space[2],
    color: colors.text.primary,
  },
  summaryText: { gap: space[1] },
  item: { gap: space[2], paddingVertical: space[4] },
  itemDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: soft.peach,
  },
  avatarLetter: { color: colors.text.primary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[4],
    borderRadius: radii.lg,
    backgroundColor: soft.butter,
  },
});
