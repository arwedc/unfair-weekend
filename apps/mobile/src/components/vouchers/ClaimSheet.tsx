import { claimVoucherSchema } from '@repo/shared';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { useState, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Stepper, Text, type SheetRef } from '@/components/ui';
import { blockedNotice } from '@/features/auth/account';
import { useAuth } from '@/features/auth/auth-context';
import { cancelPolicyText } from '@/features/offers/feed-logic';
import { useSettings } from '@/features/offers/queries';
import type { OfferDetail } from '@/features/offers/types';
import { askForPushAfterClaim } from '@/features/push/push';
import { useClaimVoucher } from '@/features/vouchers/queries';
import { maxSelectableSeats, seatsText } from '@/features/vouchers/voucher-logic';
import { errorMessage } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { colors, space } from '@/theme';

export interface ClaimSheetProps {
  ref: RefObject<SheetRef | null>;
  offer: OfferDetail;
}

/** Platzwahl und „Code holen“. Ob es klappt, entscheidet der Server (`claim_voucher`). */
export function ClaimSheet({ ref, offer }: ClaimSheetProps) {
  const router = useRouter();
  const { t, locale } = useT();
  const m = t.parts.claim;
  const { account } = useAuth();
  const { data: settings } = useSettings();
  const claim = useClaimVoucher();
  const [wanted, setWanted] = useState(1);

  const max = maxSelectableSeats(offer);
  const seats = Math.min(Math.max(wanted, 1), Math.max(max, 1));
  const blocked = account ? blockedNotice(account, locale) : null;

  const submit = () => {
    const parsed = claimVoucherSchema.safeParse({ offer_id: offer.id, seats });
    if (!parsed.success) return;
    claim.mutate(
      { offerId: parsed.data.offer_id, seats: parsed.data.seats },
      {
        onSuccess: (voucherId) => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          ref.current?.dismiss();
          if (voucherId) router.push({ pathname: '/code/[id]', params: { id: voucherId } });
          else router.navigate('/codes');
          // Guter Moment für die Push-Erlaubnis: jetzt geht es um die Erinnerung vor dem Start.
          void askForPushAfterClaim();
        },
        onError: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      },
    );
  };

  if (blocked) {
    return (
      <Sheet ref={ref} title={m.blockedTitle}>
        <Text variant="body" color="secondary">
          {blocked}
        </Text>
        <Button label={m.gotIt} fullWidth onPress={() => ref.current?.dismiss()} />
      </Sheet>
    );
  }

  return (
    <Sheet ref={ref} title={m.howMany} onDismiss={() => claim.reset()}>
      <Text variant="callout" color="secondary">
        {max > 1 ? m.upTo(seatsText(max, locale)) : m.onePerPerson}
      </Text>

      <Stepper value={seats} min={1} max={Math.max(max, 1)} onChange={setWanted} label={m.seats} />

      <View style={styles.notes}>
        <Text variant="footnote" color="secondary" align="center">
          {m.payOnSite} {cancelPolicyText(offer.type, settings?.cancel_deadline_hours, locale)}
        </Text>
        {claim.error ? (
          <Text
            variant="callout"
            align="center"
            accessibilityLiveRegion="polite"
            style={{ color: colors.status.error.text }}
          >
            {errorMessage(claim.error)}
          </Text>
        ) : null}
      </View>

      <Button
        label={seats === 1 ? m.getCode : m.getCodeFor(seatsText(seats, locale))}
        icon={Ticket}
        size="lg"
        fullWidth
        haptic
        loading={claim.isPending}
        disabled={max < 1}
        onPress={submit}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  notes: { gap: space[2] },
});
