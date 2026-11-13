import {
  formatDiscount,
  formatPrice,
  OFFER_CATEGORY_LABELS,
  seatsLabel,
  STORAGE_BUCKETS,
} from '@repo/shared';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  Globe,
  MapPin,
  Navigation,
  Phone,
  SearchX,
  Share2,
  ShieldCheck,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { OfferFavoriteButton } from '@/components/favorites/OfferFavoriteButton';
import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { ImageGallery } from '@/components/offers/ImageGallery';
import { MiniMap } from '@/components/offers/MiniMap';
import { COMPACT_CARD_WIDTH, OfferCard } from '@/components/offers/OfferCard';
import { OfferImage } from '@/components/offers/OfferImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { Stars } from '@/components/reviews/Stars';
import {
  Appear,
  Badge,
  Button,
  EmptyState,
  HighlightTitle,
  IconButton,
  PressableScale,
  Skeleton,
  Text,
  type SheetRef,
} from '@/components/ui';
import { ClaimSheet } from '@/components/vouchers/ClaimSheet';
import { useAuth } from '@/features/auth/auth-context';
import { logOfferView } from '@/features/offers/api';
import { cityOfOffer, getCity, offersInCity } from '@/features/offers/cities';
import {
  cancelPolicyText,
  offerBadges,
  offerWhenText,
  similarOffers,
} from '@/features/offers/feed-logic';
import { useLocationOffers, useOffer, useOffers, useSettings } from '@/features/offers/queries';
import type { Offer, OfferDetail } from '@/features/offers/types';
import { useLocationRating } from '@/features/reviews/queries';
import { formatRating, reviewCountLabel } from '@/features/reviews/review-logic';
import { useActiveVoucherForOffer } from '@/features/vouchers/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { callPhone, openInMaps, openWebsite } from '@/lib/open-external';
import { colors, fonts, layout, radii, radius, shadow, soft, space } from '@/theme';

/** Ab dieser Länge wird die Beschreibung erst gekürzt gezeigt („Mehr lesen“). */
const DESCRIPTION_PREVIEW_CHARS = 280;
const LOGO_SIZE = layout.minTouchTarget + space[3];

/** Zeile in der Info-Karte: Icon, Text und optional ein Pfeil, wenn sie antippbar ist. */
function InfoRow({
  icon: Icon,
  children,
  onPress,
  accessibilityLabel,
  last = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  last?: boolean;
}) {
  const content = (
    <>
      <View style={styles.infoIcon}>
        <Icon size={20} color={colors.accent.solid} strokeWidth={2} />
      </View>
      <View style={styles.infoText}>{children}</View>
      {onPress ? <ChevronRight size={20} color={colors.text.tertiary} /> : null}
    </>
  );
  const style = [styles.infoRow, !last && styles.infoRowDivider];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      pressedScale={0.99}
      style={style}
    >
      {content}
    </PressableScale>
  );
}

/** Überschrift einer Reihe mit Marker-Strich und optional „Alle“ rechts. */
function RowHeader({
  title,
  overline,
  onShowAll,
}: {
  title: string;
  overline?: string;
  onShowAll?: () => void;
}) {
  return (
    <View style={styles.rowHeader}>
      <View style={styles.rowHeaderText}>
        {overline ? (
          <Text variant="callout" color="secondary">
            {overline}
          </Text>
        ) : null}
        <HighlightTitle variant="title2">{title}</HighlightTitle>
      </View>
      {onShowAll ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`Alle Angebote von ${title}`}
          onPress={onShowAll}
          hitSlop={space[3]}
        >
          <Text variant="subhead" color="accent" style={styles.semibold}>
            Alle
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Horizontale Reihe kleiner Angebotskarten, z. B. „Ähnliche Angebote“. */
function OfferRow({ offers }: { offers: readonly Offer[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.carousel}
      decelerationRate="fast"
      snapToInterval={COMPACT_CARD_WIDTH + space[3]}
      snapToAlignment="start"
    >
      {offers.map((item, index) => (
        <Appear key={item.id} index={index}>
          <OfferCard offer={item} variant="compact" />
        </Appear>
      ))}
    </ScrollView>
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

async function shareOffer(offer: OfferDetail): Promise<void> {
  const url = Linking.createURL(`/angebot/${offer.id}`);
  const price = `${formatPrice(offer.deal_price_cents)} statt ${formatPrice(offer.original_price_cents)}`;
  try {
    await Share.share({ message: `${offer.title} bei ${offer.location_name}: ${price}. ${url}` });
  } catch {
    // Abgebrochen oder nicht möglich: nichts zu tun.
  }
}

/**
 * Detailseite eines Angebots, aufgebaut wie eine Event-Seite:
 * Galerie, Titel, Deal-Karte (Zeit, Ort, Preis, Plätze), Beschreibung, Location mit Karte,
 * ähnliche Angebote und weitere Angebote des Anbieters. Unten fest „Code holen“.
 */
export function OfferDetailScreen({ offerId }: { offerId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const claimSheet = useRef<SheetRef>(null);
  const { data: offer, error, isPending, refetch } = useOffer(offerId);
  const { data: settings } = useSettings();
  const { data: feed } = useOffers();
  const { data: locationOffers } = useLocationOffers(offer?.location_id ?? '', {
    enabled: Boolean(offer),
  });
  const { data: rating } = useLocationRating(offer?.location_id ?? '', { enabled: Boolean(offer) });
  const { userId, account } = useAuth();
  const myVoucher = useActiveVoucherForOffer(offerId);
  const [expanded, setExpanded] = useState(false);
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
          <Skeleton height={200} />
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
  const badges = offerBadges(offer).filter((item) => item.variant !== 'deal');
  const reason = unavailableReason(offer);
  const address = [offer.location_street, `${offer.location_postal_code} ${offer.location_city}`]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  const fullAddress = address || offer.address;
  const savings = offer.original_price_cents - offer.deal_price_cents;
  const description = offer.description.trim();
  const longDescription = description.length > DESCRIPTION_PREVIEW_CHARS;
  const CategoryIcon = CATEGORY_ICONS[offer.category];
  const cityId = cityOfOffer(offer);
  const similar = similarOffers(offersInCity(feed ?? [], cityId), offer);
  const moreHere = (locationOffers ?? []).filter((item) => item.id !== offer.id);
  // Die Typen sagen number, in der DB können die Koordinaten aber fehlen.
  const lat = offer.lat as number | null;
  const lng = offer.lng as number | null;

  const openMaps = () =>
    void openInMaps({ label: offer.location_name, address: fullAddress, lat, lng });
  const openLocation = () =>
    router.push({ pathname: '/standort/[id]', params: { id: offer.location_id } });

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: space[10] }}
      >
        <View>
          <ImageGallery paths={images.filter(Boolean)} title={offer.title} />
          {badges.length > 0 ? (
            <View style={styles.badges} pointerEvents="none">
              {badges.map((item) => (
                <Badge key={item.label} label={item.label} variant={item.variant} onImage />
              ))}
            </View>
          ) : null}
        </View>

        {/* Inhaltsblatt schiebt sich mit runden Ecken über das Foto */}
        <View style={styles.sheet}>
          {/* Rabatt-Sticker auf der Kante zwischen Foto und Inhalt */}
          <View
            style={styles.sticker}
            accessible
            accessibilityLabel={`${offer.discount_percent} Prozent günstiger`}
          >
            <Text style={styles.stickerValue}>{formatDiscount(offer.discount_percent)}</Text>
            <Text variant="caption" style={styles.stickerCaption}>
              Deal
            </Text>
          </View>

          <View style={styles.body}>
            {/* Titel */}
            <View style={styles.titleBlock}>
              <View style={styles.categoryPill}>
                <CategoryIcon size={14} strokeWidth={2.25} color={colors.accent.onSubtle} />
                <Text variant="caption" style={styles.categoryLabel}>
                  {OFFER_CATEGORY_LABELS[offer.category]}
                </Text>
              </View>
              <Text variant="title1" accessibilityRole="header">
                {offer.title}
              </Text>
              <Text variant="callout" color="secondary">
                von {offer.company_name}
              </Text>
              {rating ? (
                <View style={styles.ratingLine}>
                  <Stars value={rating.average_rating} size={16} />
                  <Text variant="subhead" style={styles.semibold}>
                    {formatRating(rating.average_rating)}
                  </Text>
                  <Text variant="subhead" color="secondary">
                    · {reviewCountLabel(rating.review_count)}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Preis: Karte über einer schrägen Apricot-Fläche */}
            <View style={styles.priceWrap}>
              <View style={styles.priceShape} />
              <View style={styles.priceCard}>
                <View style={styles.infoText}>
                  <Text variant="caption" color="tertiary">
                    Dein Preis mit Code
                  </Text>
                  <View style={styles.priceLine}>
                    <Text style={styles.priceValue}>{formatPrice(offer.deal_price_cents)}</Text>
                    <Text variant="callout" color="tertiary" style={styles.strike}>
                      {formatPrice(offer.original_price_cents)}
                    </Text>
                  </View>
                </View>
                <View style={styles.savings}>
                  <Text variant="caption" style={styles.savingsLabel}>
                    Du sparst
                  </Text>
                  <Text variant="bodyStrong" style={styles.savingsValue}>
                    {formatPrice(savings)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Wann, wo, wie viele */}
            <View style={styles.infoCard}>
              <InfoRow icon={CalendarClock}>
                <Text variant="bodyStrong">{offerWhenText(offer)}</Text>
                <Text variant="footnote" color="secondary">
                  {offer.type === 'einzeltermin'
                    ? 'Fester Termin'
                    : 'Du löst den Code in diesem Zeitraum vor Ort ein.'}
                </Text>
              </InfoRow>
              <InfoRow
                icon={MapPin}
                onPress={openLocation}
                accessibilityLabel={`${offer.location_name}, Anbieter ansehen`}
              >
                <Text variant="bodyStrong">{offer.location_name}</Text>
                <Text variant="footnote" color="secondary" numberOfLines={1}>
                  {fullAddress}
                </Text>
              </InfoRow>
              <InfoRow icon={Users} last>
                <Text variant="bodyStrong">{seatsLabel(offer.free_seats)}</Text>
                <Text variant="footnote" color="secondary">
                  {offer.max_per_user > 1
                    ? `Bis zu ${offer.max_per_user} Plätze pro Person`
                    : '1 Platz pro Person'}
                </Text>
              </InfoRow>
            </View>

            <View style={styles.note}>
              <ShieldCheck size={18} strokeWidth={2} color={colors.accent.solid} />
              <Text variant="footnote" color="secondary" style={styles.infoText}>
                Keine Zahlung in der App, du zahlst vor Ort.{' '}
                {cancelPolicyText(offer.type, settings?.cancel_deadline_hours)}
              </Text>
            </View>

            {/* Beschreibung */}
            {description ? (
              <View style={styles.section}>
                <HighlightTitle>Das erwartet dich</HighlightTitle>
                <Text variant="body" color="secondary" numberOfLines={expanded ? undefined : 6}>
                  {description}
                </Text>
                {longDescription ? (
                  <PressableScale
                    accessibilityRole="button"
                    onPress={() => setExpanded((value) => !value)}
                    hitSlop={space[3]}
                    style={styles.readMore}
                  >
                    <Text variant="subhead" color="accent" style={styles.semibold}>
                      {expanded ? 'Weniger anzeigen' : 'Mehr lesen'}
                    </Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : null}

            {/* Location: Logo ragt oben aus der Karte heraus */}
            <View style={styles.section}>
              <HighlightTitle>Location</HighlightTitle>
              <View style={styles.locationCard}>
                <View style={styles.logoFloat}>
                  {offer.company_logo_path ? (
                    <OfferImage
                      path={offer.company_logo_path}
                      bucket={STORAGE_BUCKETS.companyLogos}
                      style={styles.logo}
                      contentFit="cover"
                      accessibilityLabel={`Logo von ${offer.company_name}`}
                    />
                  ) : (
                    <View style={[styles.logo, styles.logoFallback]}>
                      <Text variant="title2" style={styles.logoLetter}>
                        {offer.company_name.trim().charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.favorite}>
                  <FavoriteButton locationId={offer.location_id} name={offer.location_name} />
                </View>

                <View style={styles.locationText}>
                  <Text variant="overline" color="accent">
                    {getCity(cityId).name}
                  </Text>
                  <Text variant="title3" numberOfLines={2}>
                    {offer.location_name}
                  </Text>
                  <Text variant="footnote" color="secondary" numberOfLines={2}>
                    {fullAddress}
                  </Text>
                </View>

                {lat !== null && lng !== null ? (
                  <MiniMap lat={lat} lng={lng} label={offer.location_name} onPress={openMaps} />
                ) : null}

                {offer.location_phone || offer.location_website ? (
                  <View style={styles.contactRow}>
                    {offer.location_phone ? (
                      <Button
                        label="Anrufen"
                        icon={Phone}
                        variant="outline"
                        onPress={() => void callPhone(offer.location_phone ?? '')}
                        style={styles.flex}
                      />
                    ) : null}
                    {offer.location_website ? (
                      <Button
                        label="Webseite"
                        icon={Globe}
                        variant="outline"
                        onPress={() => void openWebsite(offer.location_website ?? '')}
                        style={styles.flex}
                      />
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.contactRow}>
                  <IconButton
                    icon={Navigation}
                    variant="plain"
                    accessibilityLabel="Route in der Karten-App"
                    onPress={openMaps}
                    style={styles.routeButton}
                  />
                  <Button label="Anbieter ansehen" onPress={openLocation} style={styles.flex} />
                </View>
              </View>
            </View>

            <ReviewsSection locationId={offer.location_id} locationName={offer.location_name} />
          </View>

          {/* Ähnliche Angebote */}
          {similar.length > 0 ? (
            <View style={styles.rowSection}>
              <RowHeader title="Ähnliche Angebote" />
              <OfferRow offers={similar} />
            </View>
          ) : null}

          {/* Mehr vom Anbieter */}
          {moreHere.length > 0 ? (
            <View style={styles.rowSection}>
              <RowHeader
                overline="Noch mehr Angebote von"
                title={offer.location_name}
                onShowAll={openLocation}
              />
              <OfferRow offers={moreHere} />
            </View>
          ) : null}
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
          <View style={styles.claimRow}>
            <View>
              <Text variant="price" color="accent">
                {formatPrice(offer.deal_price_cents)}
              </Text>
              <Text variant="caption" color="tertiary" style={styles.strike}>
                statt {formatPrice(offer.original_price_cents)}
              </Text>
            </View>
            <Button
              label="Code holen"
              icon={Ticket}
              size="lg"
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
              style={styles.flex}
            />
          </View>
        )}
      </View>

      <BackButton />
      <OfferFavoriteButton
        offerId={offer.id}
        title={offer.title}
        variant="floating"
        style={[styles.heart, { top: insets.top + space[2] }]}
      />
      <IconButton
        icon={Share2}
        accessibilityLabel="Angebot teilen"
        onPress={() => void shareOffer(offer)}
        style={[styles.share, { top: insets.top + space[2] }]}
      />

      <ClaimSheet ref={claimSheet} offer={offer} />
    </View>
  );
}

/** So weit schiebt sich das Inhaltsblatt über das Foto. */
const SHEET_OVERLAP = space[6];
const STICKER_SIZE = space[20];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  back: { position: 'absolute', left: layout.screenPaddingX },
  share: { position: 'absolute', right: layout.screenPaddingX },
  heart: {
    position: 'absolute',
    right: layout.screenPaddingX + layout.minTouchTarget + space[2],
  },
  badges: {
    position: 'absolute',
    left: layout.screenPaddingX,
    bottom: SHEET_OVERLAP + space[3],
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[1.5],
  },
  sheet: {
    marginTop: -SHEET_OVERLAP,
    paddingTop: space[6],
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    backgroundColor: colors.background.default,
  },
  sticker: {
    position: 'absolute',
    zIndex: 2,
    top: -STICKER_SIZE / 2 - space[2],
    right: layout.screenPaddingX,
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    borderRadius: radii.full,
    borderWidth: space[1],
    borderColor: colors.background.default,
    backgroundColor: colors.accent.solid,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.floating,
    transform: [{ rotate: '-10deg' }],
  },
  stickerValue: {
    fontFamily: fonts.extrabold,
    fontSize: space[5],
    lineHeight: space[6],
    letterSpacing: -0.5,
    color: colors.accent.onSolid,
  },
  stickerCaption: { color: colors.accent.onSolid, fontFamily: fonts.semibold },
  body: { paddingHorizontal: layout.screenPaddingX, gap: space[8] },
  inset: { paddingHorizontal: layout.screenPaddingX },
  flex: { flex: 1 },
  semibold: { fontFamily: fonts.semibold },
  titleBlock: { gap: space[2], paddingRight: STICKER_SIZE - space[4] },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  categoryPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radii.full,
    backgroundColor: soft.tint,
  },
  categoryLabel: { color: colors.accent.onSubtle, fontFamily: fonts.semibold },

  priceWrap: { marginTop: -space[2] },
  priceShape: {
    position: 'absolute',
    top: space[3],
    bottom: -space[3],
    left: space[3],
    right: -space[1],
    borderRadius: radii.xl,
    backgroundColor: soft.tintStrong,
    transform: [{ rotate: '-2.5deg' }],
  },
  priceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    padding: space[5],
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
    boxShadow: shadow.card,
  },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  priceValue: {
    fontFamily: fonts.extrabold,
    fontSize: space[8],
    lineHeight: space[10],
    letterSpacing: -0.6,
    color: colors.text.accent,
  },
  savings: {
    alignItems: 'center',
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radii.md,
    backgroundColor: soft.warm,
  },
  savingsLabel: { color: colors.accent.onSubtle },
  savingsValue: { color: colors.accent.onSubtle },

  infoCard: {
    paddingHorizontal: space[4],
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  infoRow: {
    minHeight: layout.minTouchTarget + space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.subtle,
  },
  infoIcon: {
    width: layout.minTouchTarget - space[1],
    height: layout.minTouchTarget - space[1],
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: soft.warm,
  },
  infoText: { flex: 1, gap: space[0.5] },
  note: {
    marginTop: -space[4],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderRadius: radii.lg,
    backgroundColor: colors.background.subtle,
  },

  section: { gap: space[3] },
  readMore: { alignSelf: 'flex-start' },

  locationCard: {
    marginTop: LOGO_SIZE / 2,
    paddingHorizontal: space[4],
    paddingBottom: space[4],
    paddingTop: LOGO_SIZE / 2 + space[3],
    gap: space[4],
    borderRadius: radii.xl,
    backgroundColor: soft.warm,
  },
  logoFloat: {
    position: 'absolute',
    top: -LOGO_SIZE / 2,
    left: space[4],
    borderRadius: radii.full,
    borderWidth: space[1],
    borderColor: colors.background.default,
    boxShadow: shadow.card,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: radii.full },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
  },
  logoLetter: { color: colors.accent.onSolid },
  favorite: { position: 'absolute', top: space[2], right: space[2] },
  locationText: { gap: space[0.5] },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  routeButton: { backgroundColor: soft.tintStrong, borderRadius: radius.button },

  rowSection: { gap: space[4], paddingTop: space[10] },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space[3],
    paddingHorizontal: layout.screenPaddingX,
  },
  rowHeaderText: { flexShrink: 1, gap: space[1] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },

  claimBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[3],
    backgroundColor: colors.surface.raised,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    boxShadow: shadow.floating,
  },
  claimRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  strike: { textDecorationLine: 'line-through' },
});
