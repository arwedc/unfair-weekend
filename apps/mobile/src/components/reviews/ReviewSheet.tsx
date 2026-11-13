import * as Haptics from 'expo-haptics';
import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Sheet, Text, type SheetRef } from '@/components/ui';
import { useCreateReview } from '@/features/reviews/queries';
import { ratingWord, REVIEW_COMMENT_MAX } from '@/features/reviews/review-logic';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, space } from '@/theme';

import { StarInput } from './Stars';

export interface ReviewSheetProps {
  sheetRef: RefObject<SheetRef | null>;
  voucherId: string;
  locationName: string;
}

/** Bewertung schreiben: Sterne (Pflicht) und ein kurzer Text (optional). */
export function ReviewSheet({ sheetRef, voucherId, locationName }: ReviewSheetProps) {
  const create = useCreateReview();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const { t, locale } = useT();
  const m = t.parts.review;
  const word = ratingWord(rating, locale);

  const send = () => {
    create.mutate(
      { voucherId, rating, comment },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          sheetRef.current?.dismiss();
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  return (
    <Sheet ref={sheetRef} title={m.howWas(locationName)} onDismiss={() => create.reset()}>
      <View style={styles.stars}>
        <StarInput value={rating} onChange={setRating} />
        <Text variant="callout" color={word ? 'accent' : 'tertiary'} align="center">
          {word ?? m.tapStars}
        </Text>
      </View>

      <Input
        label={m.tellMore}
        placeholder={m.placeholder}
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={REVIEW_COMMENT_MAX}
        hint={`${comment.length}/${REVIEW_COMMENT_MAX}`}
      />

      <Text variant="footnote" color="tertiary">
        {m.privacy}
      </Text>

      {create.error ? (
        <Text
          variant="callout"
          accessibilityLiveRegion="polite"
          style={{ color: colors.status.error.text }}
        >
          {errorMessage(create.error)}
        </Text>
      ) : null}

      <Button
        label={m.send}
        size="lg"
        fullWidth
        haptic
        disabled={rating === 0}
        loading={create.isPending}
        onPress={send}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stars: { gap: space[2], paddingVertical: space[2] },
});
