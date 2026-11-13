import { OFFER_CATEGORY_LABELS, seatsLabel } from '@repo/shared';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  MapPin,
  SearchX,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ImageGallery } from '@/components/offers/ImageGallery';
import { PriceRow } from '@/components/offers/PriceRow';
import {
  Badge,
  Button,
  EmptyState,
  IconButton,
  PressableScale,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { ClaimSheet } from '@/components/vouchers/ClaimSheet';
import { useAuth } from '@/features/auth/auth-context';
import { logOfferView } from '@/features/offers/api';
import { cancelPolicyText, offerBadges, offerWhenText } from '@/features/offers/feed-logic';
import { useOffer, useSettings } from '@/features/offers/queries';
import type { OfferDetail } from '@/features/offers/types';
import { useActiveVoucherForOffer } from '@/features/vouchers/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { openInMaps } from '@/lib/open-external';
import { colors, layout, radii, shadow, space } from '@/theme';

function InfoRow({
  icon: Icon,
  title,
  detail,
  onPress,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  onPress?: () => void;
  actionLabel?: string;
}) {
  const content = (
    <>
      <View style={styles.infoIcon}>
        <Icon size={20} color={colors.text.primary} strokeWidth={2} />
      </View>
      <View style={styles.infoText}>
        <Text variant="bodyStrong">{title}</Text>
        {detail ? (
          <Text variant="footnote" color="secondary">
            {detail}
          </Text>
        ) : null}
        {actionLabel ? (
          <Text variant="footnote" color="accent">
            {actionLabel}
          </Text>
        ) : null}
      </View>
      {onPress ? <ChevronRight size={20} color={colors.text.tertiary} /> : null}
    </>
  );

  if (!onPress) return <View style={styles.infoRow}>{content}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, detail, actionLabel].filter(Boolean).join(', ')}
      onPress={onPress}
      pressedScale={0.99}
      style={styles.infoRow}
    >
      {content}
    </PressableScale>
  );
}

function BackButton() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <IconButton
      icon={ChevronLeft}
      accessibilityLabel="Zurück"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={[styles.back, { top: insets.top + space[2] }]}
    />
  );
}

function Frame({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[16] }]}>
      {children}
      <BackButton />
    </View>
  );
}

/** Warum man gerade keinen Code holen kann (oder null, wenn es geht). */
function unavailableReason(offer: OfferDetail): string | null {
  if (offer.status === 'abgesagt') return 'Dieses Angebot wurde abgesagt.';
  if (offer.status !== 'aktiv') return 'Dieses Angebot ist nicht mehr verfügbar.';
  if (!offer.is_claimable) {
    return offer.type === 'einzeltermin'
      ? 'Der Termin hat schon begonnen.'
      : 'Dieses Angebot ist abgelaufen.';
  }
  if (offer.free_seats === 0) return 'Leider ausgebucht. Schau später nochmal rein.';
  return null;
}

/** Detailseite eines Angebots: Galerie, Preis, Zeit, Plätze, Beschreibung, Ort und „Code holen“. */
export function OfferDetailScreen({ offerId }: { offerId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const claimSheet = useRef<SheetRef>(null);
  const { data: offer, error, isPending, refetch } = useOffer(offerId);
  const { data: settings } = useSettings();
  const { userId, account } = useAuth();
  const myVoucher = useActiveVoucherForOffer(offerId);
  // Ohne Konto oder ohne Namen geht es erst zur Anmeldung (dort wird auch der Name abgefragt).
  const needsLogin = userId === null || account?.profileComplete !== true;

  useEffect(() => {
    void logOfferView(offerId);
  }, [offerId]);

  if (isPending) {
    return (
      <View style={styles.screen} accessible accessibilityLabel="Angebot wird geladen">
        <Skeleton height={320} radius={0} />
        <View style={styles.body}>
          <Skeleton width="85%" height={30} />
          <Skeleton width="45%" height={18} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
        <BackButton />
      </View>
    );
  }

  if (error) {
    return (
      <Frame>
        <EmptyState
          tone="error"
          icon={CloudOff}
          title={isOffline(error) ? 'Kein Netz' : 'Das hat nicht geklappt'}
          message={errorMessage(error)}
          actionLabel="Nochmal versuchen"
          onAction={() => void refetch()}
        />
      </Frame>
    );
  }

  if (!offer) {
    return (
      <Frame>
        <EmptyState
          icon={SearchX}
          title="Angebot nicht gefunden"
          message="Das Angebot gibt es nicht mehr oder es ist gerade nicht sichtbar."
          actionLabel="Zu den Angeboten"
          onAction={() => router.replace('/')}
        />
      </Frame>
    );
  }

  const images = offer.image_paths.length > 0 ? offer.image_paths : [offer.cover_image_path];
  const badges = offerBadges(offer);
  const reason = unavailableReason(offer);
  const address = [offer.location_street, `${offer.location_postal_code} ${offer.location_city}`]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space[8] }}
      >
        <View>
          <ImageGallery paths={images.filter(Boolean)} title={offer.title} />
          <View style={styles.badges} pointerEvents="none">
            {badges.map((item) => (
              <Badge
                key={item.label}
                label={item.label}
                variant={item.variant}
                size="large"
                onImage
              />
            ))}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <Text variant="overline" color="accent">
              {OFFER_CATEGORY_LABELS[offer.category]}
            </Text>
            <Text variant="title1" accessibilityRole="header">
              {offer.title}
            </Text>
            <PriceRow
              size="large"
              originalPriceCents={offer.original_price_cents}
              dealPriceCents={offer.deal_price_cents}
            />
          </View>

          <View style={styles.infoList}>
            <InfoRow
              icon={CalendarClock}
              title={offerWhenText(offer)}
              detail={
                offer.type === 'einzeltermin'
                  ? 'Fester Termin'
                  : 'Du löst den Code in diesem Zeitraum vor Ort ein.'
              }
            />
            <InfoRow
              icon={Users}
              title={seatsLabel(offer.free_seats)}
              detail={
                offer.max_per_user > 1
                  ? `Bis zu ${offer.max_per_user} Plätze pro Person`
                  : '1 Platz pro Person'
              }
            />
            <InfoRow
              icon={ShieldCheck}
              title="Ohne Zahlung in der App"
              detail={`Du zahlst vor Ort. ${cancelPolicyText(offer.type, settings?.cancel_deadline_hours)}`}
            />
          </View>

          {offer.description.trim() ? (
            <View style={styles.section}>
              <Text variant="title3" accessibilityRole="header">
                Das erwartet dich
              </Text>
              <Text variant="body" color="secondary">
                {offer.description.trim()}
              </Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="title3" accessibilityRole="header">
              Wo
            </Text>
            <View style={styles.infoList}>
              <InfoRow
                icon={MapPin}
                title={offer.location_name}
                detail={address || offer.address}
                actionLabel="In Karten-App öffnen"
                onPress={() =>
                  void openInMaps({
                    label: offer.location_name,
                    address: address || offer.address,
                    lat: offer.lat,
                    lng: offer.lng,
                  })
                }
              />
              <InfoRow
                icon={Ticket}
                title={offer.company_name}
                detail="Mehr über den Anbieter und weitere Angebote"
                onPress={() =>
                  router.push({ pathname: '/standort/[id]', params: { id: offer.location_id } })
                }
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.claimBar, { paddingBottom: insets.bottom + space[3] }]}>
        {myVoucher ? (
          <Button
            label="Deinen Code anzeigen"
            icon={Ticket}
            size="lg"
            fullWidth
            accessibilityHint="Du hast für dieses Angebot schon einen Code"
            onPress={() => router.push({ pathname: '/code/[id]', params: { id: myVoucher.id } })}
          />
        ) : reason ? (
          <Text variant="callout" color="secondary" align="center">
            {reason}
          </Text>
        ) : (
          <Button
            label="Code holen"
            icon={Ticket}
            size="lg"
            fullWidth
            haptic
            accessibilityHint={
              needsLogin
                ? 'Dafür meldest du dich kurz an'
                : 'Sichert dir deinen Platz mit einem Gutscheincode'
            }
            onPress={() => {
              if (needsLogin) router.push('/anmelden');
              else claimSheet.current?.present();
            }}
          />
        )}
      </View>

      <BackButton />

      <ClaimSheet ref={claimSheet} offer={offer} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  back: { position: 'absolute', left: layout.screenPaddingX },
  badges: {
    position: 'absolute',
    left: layout.screenPaddingX,
    bottom: space[10],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1.5],
  },
  body: { paddingHorizontal: layout.screenPaddingX, paddingTop: space[5], gap: space[6] },
  titleBlock: { gap: space[2] },
  section: { gap: space[3] },
  infoList: { gap: space[4] },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.background.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, gap: space[0.5] },
  claimBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[3],
    backgroundColor: colors.surface.raised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    boxShadow: shadow.floating,
  },
});
