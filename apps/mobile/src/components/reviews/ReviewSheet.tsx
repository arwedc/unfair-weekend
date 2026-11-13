import * as Haptics from 'expo-haptics';
import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Input, Sheet, Text, type SheetRef } from '@/components/ui';
import { useCreateReview } from '@/features/reviews/queries';
import { ratingWord, REVIEW_COMMENT_MAX } from '@/features/reviews/review-logic';
import { errorMessage } from '@/lib/api-error';
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
  const word = ratingWord(rating);

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
    <Sheet ref={sheetRef} title={`Wie war's bei ${locationName}?`} onDismiss={() => create.reset()}>
      <View style={styles.stars}>
        <StarInput value={rating} onChange={setRating} />
        <Text variant="callout" color={word ? 'primary' : 'tertiary'} align="center">
          {word ?? 'Tipp auf die Sterne'}
        </Text>
      </View>

      <Input
        label="Erzähl gern mehr (optional)"
        placeholder="Was hat dir gefallen? Was könnte besser sein?"
        value={comment}
        onChangeText={setComment}
        multiline
        maxLength={REVIEW_COMMENT_MAX}
        hint={`${comment.length}/${REVIEW_COMMENT_MAX}`}
      />

      <Text variant="footnote" color="tertiary">
        Dein Vorname und der erste Buchstabe deines Nachnamens stehen bei der Bewertung. Du kannst
        jeden Ort einmal bewerten.
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
        label="Bewertung senden"
        size="lg"
        variant="dark"
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
