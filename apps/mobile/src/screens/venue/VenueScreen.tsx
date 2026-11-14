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
  Clock,
  CloudOff,
  CreditCard,
  Euro,
  Globe,
  MapPin,
  Phone,
  SearchX,
  Share2,
  Sparkles,
  Star,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FavoriteButton } from '@/components/favorites/FavoriteButton';
import { CATEGORY_ICONS } from '@/components/offers/category-icons';
import { ImageGallery } from '@/components/offers/ImageGallery';
import { LocationCard } from '@/components/offers/LocationCard';
import { COMPACT_CARD_WIDTH, OfferCard } from '@/components/offers/OfferCard';
import { OfferImage } from '@/components/offers/OfferImage';
import { ReviewsSection } from '@/components/reviews/ReviewsSection';
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
import { distinctSubtitle } from '@/features/offers/venue-logic';
import { useLocationRating } from '@/features/reviews/queries';
import { formatRating, reviewCountLabel } from '@/features/reviews/review-logic';
import { useBookingMode } from '@/features/payments/queries';
import { useActiveVoucherForOffer } from '@/features/vouchers/queries';
import { errorMessage, isOffline } from '@/lib/api-error';
import { haptics } from '@/lib/haptics';
import { useT } from '@/lib/i18n/context';
import { getMessages, type Messages } from '@/lib/i18n/messages';
import { callPhone, openWebsite } from '@/lib/open-external';
import { colors, fonts, layout, radii, shadow, soft, space } from '@/theme';

/** Mindesthöhe des Fotos, bevor es beim Scrollen ganz aus dem Bild läuft. */
const HERO_COLLAPSED = space[20] + space[10];

/** Zeilen, ab denen die Beschreibung gekürzt wird und „Mehr lesen“ erscheint. */
const DESCRIPTION_LINES = 3;

/** Breite einer Kachel in der Angebotsauswahl. */
const CHOICE_WIDTH = 160;

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

/** Zeile in der Deal-Karte: farbiges Icon und Text. */
function InfoRow({
  icon: Icon,
  children,
  last = false,
}: {
  icon: LucideIcon;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
      <Icon size={22} color={colors.accent.strong} strokeWidth={2} />
      <View style={styles.flexText}>{children}</View>
    </View>
  );
}

/** Beschreibung des Angebots: gekürzt, auf Wunsch ganz. */
function ExpandableText({ text }: { text: string }) {
  const { t } = useT();
  const v = t.screens.venue;
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  return (
    <View>
      {/* Unsichtbare volle Fassung zum Messen: iOS und Android melden gekürzte Zeilen verschieden. */}
      <Text
        variant="footnote"
        style={styles.measure}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onTextLayout={(event) => setCanExpand(event.nativeEvent.lines.length > DESCRIPTION_LINES)}
      >
        {text}
      </Text>
      <Text
        variant="footnote"
        color="secondary"
        numberOfLines={expanded ? undefined : DESCRIPTION_LINES}
      >
        {text}
      </Text>
      {canExpand ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          pressedScale={0.98}
          hitSlop={space[2]}
          style={styles.readMore}
        >
          <Text variant="footnote" color="accent" style={styles.semibold}>
            {expanded ? v.readLess : v.readMore}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Kachel in der Auswahl über der Deal-Karte. Antippen zeigt das Angebot in der Karte darunter. */
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
  const when = offerWhenText(offer, undefined, locale);
  const price = formatPrice(offer.deal_price_cents, { locale });
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${offer.title}, ${when}, ${price}`}
      accessibilityHint={selected ? undefined : t.screens.venue.selectOffer}
      onPress={onPress}
      pressedScale={0.97}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <View style={styles.choiceText}>
        <Text variant="caption" color="accent" style={styles.semibold} numberOfLines={1}>
          {when}
        </Text>
        <Text variant="subhead" style={styles.semibold} numberOfLines={2}>
          {offer.title}
        </Text>
      </View>
      <View style={styles.choicePrice}>
        <Text variant="subhead" color="accent" style={styles.semibold}>
          {price}
        </Text>
        <Text variant="caption" color="tertiary" style={styles.strike}>
          {formatPrice(offer.original_price_cents, { locale })}
        </Text>
      </View>
    </PressableScale>
  );
}

/** Erste Kategorie des Standorts als gelbe Pill. */
function CategoryPill({ category, label }: { category: OfferCategory; label: string }) {
  const Icon = CATEGORY_ICONS[category];
  return (
    <View style={styles.pill}>
      <Icon size={14} strokeWidth={2.25} color={colors.accent.onSubtle} />
      <Text variant="footnote" style={[styles.semibold, { color: colors.accent.onSubtle }]}>
        {label}
      </Text>
    </View>
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
 * Seite eines Unternehmensstandorts mit allen Angeboten dort. Jede Angabe steht nur einmal:
 * oben die Fotos zum Wischen (schrumpfen beim Scrollen), dann Name, Kategorie, Bewertung und Stadt.
 * Bei mehreren Angeboten eine Auswahl als Kacheln, darunter die Deal-Karte mit „Code holen“.
 * Danach „Über den Anbieter“ (Text, Anrufen, Website), „Anfahrt“ (Karte, Adresse, Route),
 * Bewertungen und Ähnliches in der Stadt.
 */
export function VenueScreen({ locationId, offerId }: VenueScreenProps) {
  const router = useRouter();
  const { t, locale, labels } = useT();
  const v = t.screens.venue;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const claimSheet = useRef<SheetRef>(null);
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

  // Fotos: groß, schrumpfen beim Scrollen und laufen danach mit dem Inhalt nach oben heraus.
  // Die Galerie liegt im Scroll-Inhalt und wird per translateY oben gehalten, damit senkrechtes
  // Wischen die Seite scrollt und waagerechtes Wischen die Bilder wechselt.
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
          [-heroHeight, heroCollapseAt],
          [-heroHeight, heroCollapseAt],
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
  const subtitle = distinctSubtitle(name, locationName);
  const address = place.data
    ? [place.data.street, `${place.data.postal_code} ${place.data.city}`]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ')
    : (offer?.address ?? '');
  const lat = place.data?.lat ?? offer?.lat ?? null;
  const lng = place.data?.lng ?? offer?.lng ?? null;
  const phone = (place.data?.phone ?? offer?.location_phone ?? '').trim();
  const website = (place.data?.website ?? offer?.location_website ?? '').trim();
  const about = (place.data?.company_description ?? offer?.company_description ?? '').trim();
  const logo = place.data?.company_logo_path ?? offer?.company_logo_path ?? '';
  const locationImages = place.data?.image_paths.length
    ? place.data.image_paths
    : offer?.image_paths.length
      ? offer.image_paths
      : (list[0]?.image_paths ?? []);
  const fallbackPath = offer?.cover_image_path ?? list[0]?.cover_image_path ?? null;
  const heroPaths = locationImages.length > 0 ? locationImages : fallbackPath ? [fallbackPath] : [];
  const categories = [
    ...new Set<OfferCategory>(
      list.map((item) => item.category).concat(offer ? [offer.category] : []),
    ),
  ];
  const [firstCategory, ...moreCategories] = categories;
  // Ohne Koordinaten wählt cityOfOffer selbst die Startstadt.
  const cityId = cityOfOffer({ lat, lng } as unknown as Pick<Offer, 'lat' | 'lng'>);
  const cityName = getCity(cityId).name;
  // Weitere Kategorien und Stadt als eine ruhige Textzeile neben der Pill.
  const metaText = [...moreCategories.map((category) => labels.offerCategory[category]), cityName]
    .filter(Boolean)
    .join(' · ');
  const similar = offer
    ? similarOffers(offersInCity(feed ?? [], cityId), offer).filter(
        (item) => item.location_id !== resolvedLocationId,
      )
    : [];
  const reason = offer ? unavailableReason(offer, v) : null;
  const description = offer?.description.trim() ?? '';
  const hasProvider = about !== '' || phone !== '' || website !== '';
  const hasDirections = address !== '' || (lat !== null && lng !== null);

  const choose = (id: string) => {
    if (id === activeId) return;
    haptics.selection();
    setSelectedId(id);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingTop: heroHeight, paddingBottom: insets.bottom + space[12] }}
      >
        {/* Fotos oben: zum Wischen, schrumpfen beim Scrollen und verschwinden danach */}
        <Animated.View style={[styles.hero, heroStyle]}>
          <ImageGallery
            paths={heroPaths}
            title={locationName}
            width={width}
            fill
            labels={{
              gallery: v.imageGalleryLabel,
              image: v.imageLabel,
              singleImage: v.singleImageLabel,
            }}
          />
        </Animated.View>

        {/* Kopf: Name, ggf. abweichender Standortname, dann Kategorie · Bewertung · Stadt */}
        <View style={styles.head}>
          <View style={styles.titleRow}>
            <Text variant="title1" accessibilityRole="header" style={styles.flex}>
              {name}
            </Text>
            <View style={styles.titleActions}>
              {resolvedLocationId ? (
                <FavoriteButton locationId={resolvedLocationId} name={name} />
              ) : null}
              {offer ? (
                <IconButton
                  icon={Share2}
                  variant="plain"
                  accessibilityLabel={v.share}
                  onPress={() => void shareOffer(offer, locale)}
                />
              ) : null}
            </View>
          </View>
          {subtitle ? (
            <Text variant="callout" color="secondary">
              {subtitle}
            </Text>
          ) : null}
          <View style={styles.meta}>
            {firstCategory ? (
              <CategoryPill category={firstCategory} label={labels.offerCategory[firstCategory]} />
            ) : null}
            {rating.data ? (
              <View
                style={styles.metaItem}
                accessible
                accessibilityLabel={`${t.parts.review.starsAria(
                  formatRating(rating.data.average_rating, locale),
                )}, ${reviewCountLabel(rating.data.review_count, locale)}`}
              >
                <Star
                  size={15}
                  strokeWidth={1.75}
                  color={colors.accent.vivid}
                  fill={colors.accent.vivid}
                />
                <Text variant="footnote" style={styles.semibold}>
                  {formatRating(rating.data.average_rating, locale)}
                </Text>
                <Text variant="footnote" color="secondary">
                  ({rating.data.review_count})
                </Text>
              </View>
            ) : null}
            {metaText ? (
              <View style={styles.metaItem}>
                <MapPin size={14} strokeWidth={2.25} color={colors.text.secondary} />
                <Text variant="footnote" color="secondary">
                  {metaText}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Auswahl, wenn es hier mehrere Angebote gibt: wechselt die Deal-Karte darunter */}
        {list.length > 1 ? (
          <View style={styles.choices}>
            <View style={styles.inset}>
              <Text variant="subhead" color="secondary" style={styles.semibold}>
                {v.offersHere(list.length)}
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carousel}
              decelerationRate="fast"
              snapToInterval={CHOICE_WIDTH + space[3]}
              snapToAlignment="start"
            >
              {list.map((item) => (
                <OfferChoice
                  key={item.id}
                  offer={item}
                  selected={item.id === activeId}
                  onPress={() => choose(item.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* Deal-Karte des ausgewählten Angebots */}
        <View style={styles.cardOuter}>
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
                      <ExpandableText key={offer.id} text={description} />
                    </View>
                  ) : null}
                </View>

                <View>
                  <InfoRow icon={Clock}>
                    <Text variant="body">{offerWhenText(offer, undefined, locale)}</Text>
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
          {/* Über den Anbieter: Text, Anrufen, Website (nur was es gibt) */}
          {hasProvider ? (
            <View style={styles.section}>
              <HighlightTitle>{v.aboutProvider}</HighlightTitle>
              {about ? (
                <View style={styles.aboutRow}>
                  {logo ? (
                    <OfferImage
                      path={logo}
                      bucket={STORAGE_BUCKETS.companyLogos}
                      style={styles.logo}
                      contentFit="cover"
                      accessibilityLabel={v.logoOf(name)}
                    />
                  ) : null}
                  <Text variant="body" color="secondary" style={styles.flex}>
                    {about}
                  </Text>
                </View>
              ) : null}
              {phone || website ? (
                <View style={styles.actions}>
                  {phone ? (
                    <Button
                      label={v.call}
                      icon={Phone}
                      variant="outline"
                      onPress={() => void callPhone(phone)}
                      style={styles.flex}
                    />
                  ) : null}
                  {website ? (
                    <Button
                      label={v.web}
                      icon={Globe}
                      variant="outline"
                      onPress={() => void openWebsite(website)}
                      style={styles.flex}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Anfahrt: Karte und Adresse, Antippen öffnet die Karten-App */}
          {hasDirections ? (
            <View style={styles.section}>
              <HighlightTitle>{v.directions}</HighlightTitle>
              <LocationCard name={locationName} address={address} lat={lat} lng={lng} />
            </View>
          ) : null}

          {resolvedLocationId ? (
            <ReviewsSection locationId={resolvedLocationId} locationName={name} />
          ) : null}
        </View>

        {/* Ähnliches bei anderen Anbietern */}
        {similar.length > 0 ? (
          <View style={styles.similar}>
            <View style={styles.inset}>
              <HighlightTitle variant="title2">{v.similarIn(cityName)}</HighlightTitle>
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

      <BackButton top={buttonTop} />

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
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2] },
  titleActions: { flexDirection: 'row', gap: space[1], marginRight: -space[2] },

  head: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space[5],
    paddingBottom: space[5],
    gap: space[2],
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space[3],
    rowGap: space[2],
    paddingTop: space[1],
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    paddingHorizontal: space[3],
    paddingVertical: space[1.5],
    borderRadius: radii.full,
    backgroundColor: soft.tint,
  },

  choices: { gap: space[2], paddingBottom: space[4] },
  choice: {
    width: CHOICE_WIDTH,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface.raised,
    minHeight: space[20] + space[5],
    padding: space[3],
    gap: space[2],
    justifyContent: 'space-between',
  },
  choiceSelected: { borderColor: colors.accent.strong, backgroundColor: soft.warm },
  choiceText: { gap: space[0.5] },
  choicePrice: { flexDirection: 'row', alignItems: 'baseline', gap: space[2] },

  cardOuter: { paddingHorizontal: layout.screenPaddingX },
  card: {
    borderRadius: radii.xl,
    backgroundColor: colors.surface.raised,
    boxShadow: shadow.card,
    overflow: 'hidden',
  },
  offerTitleText: { flex: 1, gap: space[1] },
  descriptionPreview: { gap: space[0.5], paddingTop: space[1] },
  measure: { position: 'absolute', left: 0, right: 0, opacity: 0 },
  readMore: { alignSelf: 'flex-start', paddingTop: space[1] },
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

  aboutRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3] },
  logo: {
    width: layout.minTouchTarget + space[3],
    height: layout.minTouchTarget + space[3],
    borderRadius: radii.full,
  },
  actions: { flexDirection: 'row', gap: space[2] },

  similar: { gap: space[4], paddingTop: space[10] },
  carousel: { flexDirection: 'row', paddingHorizontal: layout.screenPaddingX, gap: space[3] },
});
