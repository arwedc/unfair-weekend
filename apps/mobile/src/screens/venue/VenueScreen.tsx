import {
  formatDiscount,
  formatPrice,
  seatsLabel,
  STORAGE_BUCKETS,
  type OfferCategory,
} from '@repo/shared';
import type { Locale } from '@repo/shared/i18n';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CloudOff,
  CreditCard,
  Euro,
  Globe,
  MapPin,
  Navigation,
  Phone,
  SearchX,
  Share2,
  Sparkles,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { MiniMap } from '@/components/offers/MiniMap';
import { COMPACT_CARD_WIDTH, OfferCard } from '@/components/offers/OfferCard';
import { OfferImage } from '@/components/offers/OfferImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
import { Stars } from '@/components/reviews/Stars';
import {
  Appear,
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
import { cancelPolicyText, offerWhenText, similarOffers } from '@/features/offers/feed-logic';
import {
  useLocation,
  useLocationOffers,
  useOffer,
  useOffers,
  useSettings,
} from '@/features/offers/queries';
import type { Offer, OfferDetail } from '@/features/offers/types';
import { useLocationRating } from '@/features/reviews/queries';
import { formatRating, reviewCountLabel } from '@/features/reviews/review-logic';
import { useBookingMode } from '@/features/payments/queries';
import { useActiveVoucherForOffer } from '@/features/vouchers/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { useT } from '@/lib/i18n/context';
import { getMessages, type Messages } from '@/lib/i18n/messages';
import { callPhone, openInMaps, openWebsite } from '@/lib/open-external';
import { colors, fonts, layout, radii, shadow, soft, space } from '@/theme';

/** Mindesthöhe des Fotos, bevor es beim Scrollen ganz aus dem Bild läuft. */
const HERO_COLLAPSED = space[20] + space[10];

/** Warum man gerade keinen Code holen kann (oder null, wenn es geht). */
function unavailableReason(offer: OfferDetail, m: Messages['screens']['venue']): string | null {
  if (offer.status === 'abgesagt') return m.cancelled;
  if (offer.status !== 'aktiv') return m.unavailable;
  if (!offer.is_claimable) {
    return offer.type === 'einzeltermin' ? m.started : m.expired;
  }
  if (offer.free_seats === 0) return m.soldOut;
  return null;
}

async function shareOffer(offer: OfferDetail, locale: Locale): Promise<void> {
  const m = getMessages(locale).screens.venue;
  const url = Linking.createURL(`/angebot/${offer.id}`);
  const price = m.sharePrice(
    formatPrice(offer.deal_price_cents, { locale }),
    formatPrice(offer.original_price_cents, { locale }),
  );
  try {
    await Share.share({ message: m.shareMessage(offer.title, offer.location_name, price, url) });
  } catch {
    // Abgebrochen oder nicht möglich: nichts zu tun.
  }
}

/** Zeile in der Deal-Karte: farbiges Icon, Text, optional Pfeil. */
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
      <Icon size={22} color={colors.accent.strong} strokeWidth={2} />
      <View style={styles.flexText}>{children}</View>
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

/** Ein Angebot in der Liste „Angebote hier“. Antippen wählt es oben in der Deal-Karte aus. */
function OfferChoice({
  offer,
  selected,
  onPress,
}: {
  offer: Offer;
  selected: boolean;
  onPress: () => void;
}) {
  const { t, locale } = useT();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${offer.title}, ${offerWhenText(offer, undefined, locale)}, ${formatPrice(offer.deal_price_cents, { locale })}`}
      accessibilityHint={t.screens.venue.showOnTop}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <OfferImage path={offer.cover_image_path} style={styles.choiceImage} />
      <View style={styles.flexText}>
        <Text variant="bodyStrong" numberOfLines={2}>
          {offer.title}
        </Text>
        <Text variant="footnote" color="secondary" numberOfLines={1}>
          {offerWhenText(offer, undefined, locale)}
        </Text>
        <View style={styles.choicePrice}>
          <Text variant="subhead" color="accent" style={styles.semibold}>
            {formatPrice(offer.deal_price_cents, { locale })}
          </Text>
          <Text variant="caption" color="tertiary" style={styles.strike}>
            {formatPrice(offer.original_price_cents, { locale })}
          </Text>
        </View>
      </View>
      {selected ? (
        <View style={styles.choiceBadge}>
          <Text variant="caption" style={styles.choiceBadgeText}>
            Oben
          </Text>
        </View>
      ) : (
        <ChevronRight size={20} color={colors.text.tertiary} />
      )}
    </PressableScale>
  );
}

function BackButton({ top }: { top: number }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <IconButton
      icon={ChevronLeft}
      accessibilityLabel={t.screens.venue.back}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      style={[styles.back, { top }]}
    />
  );
}

export interface VenueScreenProps {
  /** Standort direkt (Route /standort/[id]). */
  locationId?: string;
  /** Angebot, das oben ausgewählt sein soll (Route /angebot/[id]). Bestimmt sonst auch den Standort. */
  offerId?: string;
}

/**
 * Seite eines Unternehmensstandorts mit allen Angeboten dort.
 * Oben ein großes Foto, das beim Scrollen zu einem schmalen Streifen schrumpft und dann verschwindet.
 * Darunter die Deal-Karte des ausgewählten Angebots mit „Code holen“, die übrigen Angebote zum
 * Umschalten, Infos und Karte zum Ort, Bewertungen und Ähnliches in der Nähe.
 */
export function VenueScreen({ locationId, offerId }: VenueScreenProps) {
  const router = useRouter();
  const { t, locale, labels } = useT();
  const v = t.screens.venue;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const claimSheet = useRef<SheetRef>(null);
  const cardY = useRef(0);
  const [selectedId, setSelectedId] = useState<string | null>(offerId ?? null);

  // Über ein Angebot kommen wir zum Standort; direkt über den Standort zum ersten Angebot.
  const entry = useOffer(offerId ?? '', { enabled: Boolean(offerId) && !locationId });
  const resolvedLocationId = locationId ?? entry.data?.location_id ?? '';
  const place = useLocation(resolvedLocationId);
  const offers = useLocationOffers(resolvedLocationId);
  const activeId = selectedId ?? offers.data?.[0]?.id ?? '';
  const selected = useOffer(activeId);
  const rating = useLocationRating(resolvedLocationId);
  const { data: settings } = useSettings();
  const { data: feed } = useOffers();
  const { userId, account } = useAuth();
  const myVoucher = useActiveVoucherForOffer(activeId);
  const needsLogin = userId === null || account?.profileComplete !== true;
  const paid = useBookingMode() === 'bezahlung';

  useEffect(() => {
    if (activeId) void logOfferView(activeId);
  }, [activeId]);

  // Foto: groß, schrumpft beim Scrollen und läuft nach einem kurzen Moment ganz nach oben heraus.
  const heroHeight = Math.round(width * 0.85);
  const heroMin = insets.top + HERO_COLLAPSED;
  const heroCollapseAt = heroHeight - heroMin;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.set(event.contentOffset.y);
  });
  const heroStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.get(),
      [-heroHeight, 0, heroHeight - heroMin],
      [heroHeight * 2, heroHeight, heroMin],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          scrollY.get(),
          [0, heroCollapseAt, heroCollapseAt + heroMin],
          [0, 0, -heroMin],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const buttonTop = insets.top + space[2];
  const loadingLocation = (Boolean(offerId) && !locationId && entry.isPending) || place.isPending;

  if (loadingLocation || (activeId !== '' && selected.isPending && !place.data)) {
    return (
      <View style={styles.screen} accessible accessibilityLabel={v.loading}>
        <Skeleton height={heroHeight} radius={0} />
        <View style={styles.body}>
          <Skeleton width="70%" height={32} />
          <Skeleton width="40%" height={18} />
          <Skeleton height={260} />
        </View>
        <BackButton top={buttonTop} />
      </View>
    );
  }

  const error = entry.error ?? place.error ?? offers.error;
  const offer = selected.data ?? null;
  // Standort nicht (mehr) öffentlich, aber das Angebot schon (z. B. mit eigenem Code): Daten vom Angebot.
  const name = place.data?.company_name ?? offer?.company_name ?? '';

  if (error || !name) {
    return (
      <View style={[styles.screen, styles.frame, { paddingTop: insets.top + space[16] }]}>
        {error ? (
          <EmptyState
            tone="error"
            icon={CloudOff}
            title={isOffline(error) ? t.common.noNetwork : t.common.failed}
            message={errorMessage(error)}
            actionLabel={t.common.retry}
            onAction={() => {
              void entry.refetch();
              void place.refetch();
              void offers.refetch();
            }}
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title={v.notFoundTitle}
            message={v.notFoundText}
            actionLabel={v.toOffers}
            onAction={() => router.replace('/')}
          />
        )}
        <BackButton top={buttonTop} />
      </View>
    );
  }

  const list = offers.data ?? [];
  const locationName = place.data?.name ?? offer?.location_name ?? name;
  const showLocationName = locationName.trim() !== '' && locationName !== name;
  const address = place.data
    ? [place.data.street, `${place.data.postal_code} ${place.data.city}`]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ')
    : (offer?.address ?? '');
  const lat = place.data?.lat ?? offer?.lat ?? null;
  const lng = place.data?.lng ?? offer?.lng ?? null;
  const phone = place.data?.phone ?? offer?.location_phone ?? '';
  const website = place.data?.website ?? offer?.location_website ?? '';
  const about = (place.data?.company_description ?? offer?.company_description ?? '').trim();
  const logo = place.data?.company_logo_path ?? offer?.company_logo_path ?? '';
  const heroPath = offer?.cover_image_path || list[0]?.cover_image_path || null;
  const categories = [
    ...new Set<OfferCategory>(
      list.map((item) => item.category).concat(offer ? [offer.category] : []),
    ),
  ];
  // Ohne Koordinaten wählt cityOfOffer selbst die Startstadt.
  const cityId = cityOfOffer({ lat, lng } as unknown as Pick<Offer, 'lat' | 'lng'>);
  const similar = offer
    ? similarOffers(offersInCity(feed ?? [], cityId), offer).filter(
        (item) => item.location_id !== resolvedLocationId,
      )
    : [];
  const reason = offer ? unavailableReason(offer, v) : null;
  const description = offer?.description.trim() ?? '';

  const openMaps = () => void openInMaps({ label: locationName, address, lat, lng });
  const choose = (id: string) => {
    setSelectedId(id);
    scrollRef.current?.scrollTo({
      y: Math.max(0, cardY.current - heroMin - space[4]),
      animated: true,
    });
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: heroHeight, paddingBottom: insets.bottom + space[12] }}
      >
        {/* Kopf: Name, Kategorien, Bewertung */}
        <View style={styles.head}>
          <Text variant="title1" accessibilityRole="header">
            {name}
          </Text>
          {showLocationName ? (
            <Text variant="callout" color="secondary">
              {locationName}
            </Text>
          ) : null}
          <View style={styles.pills}>
            {categories.map((category, index) => {
              const Icon = CATEGORY_ICONS[category];
              return (
                <View key={category} style={[styles.pill, index === 0 && styles.pillAccent]}>
                  <Icon
                    size={14}
                    strokeWidth={2.25}
                    color={index === 0 ? colors.accent.onSubtle : colors.text.secondary}
                  />
                  <Text
                    variant="footnote"
                    style={[styles.semibold, index === 0 && { color: colors.accent.onSubtle }]}
                  >
                    {labels.offerCategory[category]}
                  </Text>
                </View>
              );
            })}
            <View style={styles.pill}>
              <MapPin size={14} strokeWidth={2.25} color={colors.text.secondary} />
              <Text variant="footnote" style={styles.semibold}>
                {getCity(cityId).name}
              </Text>
            </View>
          </View>
          {rating.data ? (
            <View style={styles.ratingLine}>
              <Stars value={rating.data.average_rating} size={18} />
              <Text variant="subhead" style={styles.semibold}>
                {formatRating(rating.data.average_rating, locale)}
              </Text>
              <Text variant="subhead" color="secondary">
                · {reviewCountLabel(rating.data.review_count, locale)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.offerHeading}>
          <HighlightTitle>{`Angebote bei ${name}`}</HighlightTitle>
        </View>

        {/* Deal-Karte des ausgewählten Angebots */}
        <View
          style={styles.cardOuter}
          onLayout={(event) => {
            cardY.current = event.nativeEvent.layout.y;
          }}
        >
          {offer ? (
            <View style={styles.card}>
              <View style={styles.cardBody}>
                <View style={styles.offerTitleText}>
                  <Text variant="caption" color="accent" style={styles.semibold}>
                    {v.discount(formatDiscount(offer.discount_percent, locale))}
                  </Text>
                  <Text variant="title2">{offer.title}</Text>
                  {description ? (
                    <View style={styles.descriptionPreview}>
                      <Text variant="subhead" color="secondary">
                        {v.whatToExpect}
                      </Text>
                      <Text variant="footnote" color="secondary" numberOfLines={2}>
                        {description}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View>
                  <InfoRow icon={Clock}>
                    <Text variant="body">{offerWhenText(offer, undefined, locale)}</Text>
                  </InfoRow>
                  <InfoRow
                    icon={MapPin}
                    onPress={openMaps}
                    accessibilityLabel={v.openInMaps(address)}
                  >
                    <Text variant="body">{locationName}</Text>
                    <Text variant="footnote" color="secondary" numberOfLines={1}>
                      {address}
                    </Text>
                  </InfoRow>
                  <InfoRow icon={Euro}>
                    <View style={styles.choicePrice}>
                      <Text variant="bodyStrong" color="accent">
                        {formatPrice(offer.deal_price_cents, { locale })}
                      </Text>
                      <Text variant="footnote" color="tertiary" style={styles.strike}>
                        {formatPrice(offer.original_price_cents, { locale })}
                      </Text>
                    </View>
                    <Text variant="footnote" color="secondary">
                      {paid ? v.payInAppShort : v.payOnSiteShort}
                    </Text>
                  </InfoRow>
                  <InfoRow icon={Users} last>
                    <Text variant="body">{seatsLabel(offer.free_seats, locale)}</Text>
                    <Text variant="footnote" color="secondary">
                      {v.perPerson(offer.max_per_user)}
                    </Text>
                  </InfoRow>
                </View>

                {!myVoucher && !reason ? (
                  <Text variant="caption" color="tertiary" align="center">
                    {cancelPolicyText(offer.type, settings?.cancel_deadline_hours, locale)}
                  </Text>
                ) : null}

                {myVoucher ? (
                  <Button
                    label={v.showCode}
                    icon={Ticket}
                    size="lg"
                    fullWidth
                    onPress={() =>
                      router.push({ pathname: '/code/[id]', params: { id: myVoucher.id } })
                    }
                  />
                ) : reason ? (
                  <View style={styles.reason}>
                    <Text variant="callout" color="secondary" align="center">
                      {reason}
                    </Text>
                  </View>
                ) : (
                  <Button
                    label={paid ? v.book : v.getCode}
                    icon={paid ? CreditCard : Ticket}
                    size="lg"
                    fullWidth
                    haptic
                    accessibilityHint={needsLogin ? v.loginHint : paid ? v.bookHint : v.claimHint}
                    onPress={() => {
                      if (needsLogin) router.push('/anmelden');
                      else claimSheet.current?.present();
                    }}
                  />
                )}
              </View>
            </View>
          ) : selected.isPending && activeId !== '' ? (
            <Skeleton height={320} radius={radii.xl} />
          ) : (
            <EmptyState icon={Sparkles} title={v.noOfferTitle} message={v.noOfferText} />
          )}
        </View>

        <View style={styles.body}>
          {/* Weitere Angebote am Standort */}
          {list.length > 1 ? (
            <View style={styles.section}>
              <HighlightTitle>{v.offersHere(list.length)}</HighlightTitle>
              <View style={styles.choices}>
                {list.map((item) => (
                  <OfferChoice
                    key={item.id}
                    offer={item}
                    selected={item.id === activeId}
                    onPress={() => choose(item.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Über den Anbieter und Ort */}
          <View style={styles.section}>
            <HighlightTitle>{v.about(name)}</HighlightTitle>
            <View style={styles.aboutHead}>
              {logo ? (
                <OfferImage
                  path={logo}
                  bucket={STORAGE_BUCKETS.companyLogos}
                  style={styles.logo}
                  contentFit="cover"
                  accessibilityLabel={v.logoOf(name)}
                />
              ) : (
                <View style={[styles.logo, styles.logoFallback]}>
                  <Text variant="title3" style={{ color: colors.accent.onSolid }}>
                    {name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.flexText}>
                <Text variant="bodyStrong">{locationName}</Text>
                <Text variant="footnote" color="secondary">
                  {address}
                </Text>
              </View>
            </View>
            {about ? (
              <Text variant="body" color="secondary">
                {about}
              </Text>
            ) : null}
            {lat !== null && lng !== null ? (
              <MiniMap lat={lat} lng={lng} label={locationName} />
            ) : null}
            <View style={styles.actions}>
              <Button
                label={v.route}
                icon={Navigation}
                variant="secondary"
                onPress={openMaps}
                accessibilityHint={v.routeHint}
                style={styles.flex}
              />
              {phone.trim() ? (
                <Button
                  label={v.call}
                  icon={Phone}
                  variant="outline"
                  onPress={() => void callPhone(phone)}
                  style={styles.flex}
                />
              ) : null}
              {website.trim() ? (
                <Button
                  label={v.web}
                  icon={Globe}
                  variant="outline"
                  onPress={() => void openWebsite(website)}
                  style={styles.flex}
                />
              ) : null}
            </View>
          </View>

          {resolvedLocationId ? (
            <ReviewsSection locationId={resolvedLocationId} locationName={name} />
          ) : null}
        </View>

        {/* Ähnliches bei anderen Anbietern */}
        {similar.length > 0 ? (
          <View style={styles.similar}>
            <View style={styles.inset}>
              <HighlightTitle variant="title2">{v.similarIn(getCity(cityId).name)}</HighlightTitle>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              decelerationRate="fast"
              snapToInterval={COMPACT_CARD_WIDTH + space[3]}
              snapToAlignment="start"
            >
              {similar.map((item, index) => (
                <Appear key={item.id} index={index}>
                  <OfferCard offer={item} variant="compact" />
                </Appear>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </Animated.ScrollView>

      {/* Foto oben: schrumpft beim Scrollen und verschwindet danach aus dem Viewport */}
      <Animated.View style={[styles.hero, heroStyle]} pointerEvents="none">
        <OfferImage
          path={heroPath}
          style={StyleSheet.absoluteFill}
          priority="high"
          accessibilityLabel={offer?.title ?? name}
        />
      </Animated.View>

      <BackButton top={buttonTop} />
      <View style={[styles.topRight, { top: buttonTop }]}>
        {resolvedLocationId ? (
          <View style={styles.floatingCircle}>
            <FavoriteButton locationId={resolvedLocationId} name={name} />
          </View>
        ) : null}
        {offer ? (
          <IconButton
            icon={Share2}
            accessibilityLabel={v.share}
            onPress={() => void shareOffer(offer, locale)}
          />
        ) : null}
      </View>

      {offer ? <ClaimSheet ref={claimSheet} offer={offer} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background.default },
  frame: { paddingHorizontal: layout.screenPaddingX },
  flex: { flex: 1 },
  flexText: { flex: 1, gap: space[0.5] },
  semibold: { fontFamily: fonts.semibold },
  strike: { textDecorationLine: 'line-through' },
  inset: { paddingHorizontal: layout.screenPaddingX },

  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: colors.background.muted,
  },
  back: { position: 'absolute', left: layout.screenPaddingX },
  topRight: {
    position: 'absolute',
    right: layout.screenPaddingX,
    flexDirection: 'row',
    gap: space[2],
  },
  floatingCircle: {
    borderRadius: radii.full,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.floating,
  },

  head: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[5],
    paddingBottom: space[5],
    gap: space[2],
  },
  offerHeading: { paddingHorizontal: layout.screenPaddingX, paddingBottom: space[3] },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], paddingTop: space[1] },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    backgroundColor: colors.background.muted,
  },
  pillAccent: { backgroundColor: soft.tint },
  ratingLine: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], paddingTop: space[1] },

  cardOuter: { paddingHorizontal: layout.screenPaddingX },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  offerTitleText: { flex: 1, gap: space[1] },
  descriptionPreview: { gap: space[0.5], paddingTop: space[1] },
  cardBody: { padding: space[4], gap: space[3] },
  infoRow: {
    minHeight: layout.minTouchTarget + space[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
  },
  infoRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  reason: { padding: space[3], borderRadius: radii.lg, backgroundColor: colors.background.subtle },
  body: { paddingHorizontal: layout.screenPaddingX, paddingTop: space[10], gap: space[10] },
  section: { gap: space[3] },
  choices: { gap: space[2] },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[2],
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.raised,
  },
  choiceSelected: { borderColor: colors.accent.strong, backgroundColor: soft.warm },
  choiceImage: { width: space[20], height: space[16], borderRadius: radii.md },
  choicePrice: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },
  choiceBadge: {
    paddingHorizontal: space[2],
    paddingVertical: space[0.5],
    borderRadius: radii.full,
    backgroundColor: colors.accent.solid,
  },
  choiceBadgeText: { color: colors.accent.onSolid, fontFamily: fonts.semibold },

  aboutHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  logo: {
    width: layout.minTouchTarget + space[3],
    height: layout.minTouchTarget + space[3],
    borderRadius: radii.full,
  },
  logoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent.solid,
  },
  actions: { flexDirection: 'row', gap: space[2] },

  similar: { gap: space[4], paddingTop: space[10] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },
});
