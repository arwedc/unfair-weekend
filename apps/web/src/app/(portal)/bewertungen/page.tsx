import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { formatDate } from '@repo/shared/utils';
import { Stars } from '@/components/reviews/stars';
import { Card } from '@/components/ui';
import { requireAccount } from '@/lib/auth';
import { getT } from '@/lib/i18n/locale';
import { formatRating, reviewCountLabel, reviewDateLabel } from '@/lib/reviews/format';
import {
  getMyReviewSummary,
  listMyReviews,
  type LocationReview,
  type ReviewSummary,
} from '@/lib/reviews/queries';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t.reviews.title };
}

type I18n = Awaited<ReturnType<typeof getT>>;

interface PageProps {
  searchParams: Promise<{ sterne?: string; seite?: string }>;
}

const RATINGS = [5, 4, 3, 2, 1] as const;

/** Link auf diese Seite mit Filter und Seite (Standardwerte fallen weg). */
function reviewsHref(rating: number | undefined, page = 1): string {
  const params = new URLSearchParams();
  if (rating) params.set('sterne', String(rating));
  if (page > 1) params.set('seite', String(page));
  const query = params.toString();
  return query ? `/bewertungen?${query}` : '/bewertungen';
}

function parseRating(value: string | undefined): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : undefined;
}

function parsePage(value: string | undefined): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

function SummaryCard({
  summary,
  rating,
  i18n,
}: {
  summary: ReviewSummary;
  rating?: number;
  i18n: I18n;
}) {
  const { locale, t } = i18n;
  const r = t.reviews;
  const max = Math.max(1, ...summary.distribution);
  return (
    <Card className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:gap-10 sm:p-6">
      <div className="flex flex-col items-start justify-center gap-1.5 sm:min-w-40">
        {summary.averageRating !== null ? (
          <>
            <p className="text-display text-text-primary">
              {formatRating(summary.averageRating, locale)}
            </p>
            <Stars value={summary.averageRating} size={20} locale={locale} />
          </>
        ) : (
          <p className="text-title2 text-text-tertiary">–</p>
        )}
        <p className="text-subhead text-text-secondary">
          {reviewCountLabel(summary.reviewCount, locale)}
        </p>
        {summary.last30Days > 0 ? (
          <p className="text-footnote text-text-tertiary">{r.last30Days(summary.last30Days)}</p>
        ) : null}
      </div>

      <nav aria-label={r.filterLabel}>
        <ul className="space-y-1">
          {RATINGS.map((stars) => {
            const count = summary.distribution[stars - 1] ?? 0;
            const active = rating === stars;
            return (
              <li key={stars}>
                <Link
                  href={active ? reviewsHref(undefined) : reviewsHref(stars)}
                  aria-current={active ? 'true' : undefined}
                  aria-label={r.filterAria(stars, count, active)}
                  className={`grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-3 rounded-input px-2 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-border-focus ${
                    active ? 'bg-accent-subtle' : 'hover:bg-background-muted'
                  }`}
                >
                  <span className="text-subhead text-text-secondary">{r.stars(stars)}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-background-muted">
                    <span
                      className="block h-full rounded-full bg-accent-vivid"
                      style={{ width: `${Math.round((count / max) * 100)}%` }}
                    />
                  </span>
                  <span className="text-right text-subhead tabular-nums text-text-primary">
                    {count}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </Card>
  );
}

function ReviewItem({ review, i18n }: { review: LocationReview; i18n: I18n }) {
  const { locale, t } = i18n;
  return (
    <Card className={`p-5 ${review.isHidden ? 'border-dashed bg-surface-default' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="flex items-center gap-3">
          <Stars value={review.rating} locale={locale} />
          <span className="text-body-strong text-text-primary">{review.authorName}</span>
        </div>
        <time
          dateTime={review.createdAt}
          title={formatDate(review.createdAt, { withYear: true, locale })}
          className="text-footnote text-text-tertiary"
        >
          {reviewDateLabel(review.createdAt, new Date(), locale)}
        </time>
      </div>

      {review.comment ? (
        <p className="mt-3 whitespace-pre-line text-callout text-text-primary">{review.comment}</p>
      ) : (
        <p className="mt-3 text-callout italic text-text-tertiary">{t.reviews.noText}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-footnote text-text-secondary">
        {review.offerId && review.offerTitle ? (
          <span>
            {t.reviews.aboutOffer}{' '}
            <Link href={`/angebote/${review.offerId}`} className="text-text-link hover:underline">
              {review.offerTitle}
            </Link>
          </span>
        ) : null}
        {review.isHidden ? (
          <span className="rounded-badge bg-background-muted px-1.5 py-0.5 text-caption text-text-secondary">
            {t.reviews.hiddenBadge}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

async function Reviews({ searchParams }: PageProps) {
  const [, params, i18n] = await Promise.all([requireAccount(), searchParams, getT()]);
  const r = i18n.t.reviews;
  const rating = parseRating(params.sterne);
  const page = parsePage(params.seite);

  const [summary, { reviews, hasMore }] = await Promise.all([
    getMyReviewSummary(),
    listMyReviews({ rating, page }),
  ]);

  if (summary.reviewCount === 0 && summary.hiddenCount === 0) {
    return (
      <Card className="p-10 text-center">
        <p className="text-headline text-text-primary">{r.emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-md text-callout text-text-secondary">{r.emptyText}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SummaryCard summary={summary} rating={rating} i18n={i18n} />

      {summary.hiddenCount > 0 ? (
        <p className="text-footnote text-text-tertiary">
          {r.hiddenCount(summary.hiddenCount)} {r.hiddenExplain}
        </p>
      ) : null}

      <section aria-labelledby="reviews-list">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 id="reviews-list" className="text-headline text-text-primary">
            {rating ? r.stars(rating) : r.all}
          </h2>
          {rating ? (
            <Link
              href={reviewsHref(undefined)}
              className="text-subhead text-text-link hover:underline"
            >
              {r.clearFilter}
            </Link>
          ) : null}
        </div>

        {reviews.length === 0 ? (
          <Card className="p-6 text-center text-callout text-text-secondary">
            {page > 1 ? r.noMoreOnPage : r.noneWithRating}
          </Card>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewItem review={review} i18n={i18n} />
              </li>
            ))}
          </ul>
        )}

        {page > 1 || hasMore ? (
          <nav aria-label={r.pages} className="mt-5 flex items-center justify-between gap-3">
            {page > 1 ? (
              <Link
                href={reviewsHref(rating, page - 1)}
                className="text-subhead text-text-link hover:underline"
              >
                {r.newer}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-footnote text-text-tertiary">{r.page(page)}</span>
            {hasMore ? (
              <Link
                href={reviewsHref(rating, page + 1)}
                className="text-subhead text-text-link hover:underline"
              >
                {r.older}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

export default async function ReviewsPage(props: PageProps) {
  const { t } = await getT();
  return (
    <>
      <div className="mb-6">
        <h1 className="text-title2 text-text-primary">{t.reviews.title}</h1>
        <p className="mt-1 text-callout text-text-secondary">{t.reviews.intro}</p>
      </div>
      <Suspense fallback={<p className="text-callout text-text-tertiary">{t.reviews.loading}</p>}>
        <Reviews {...props} />
      </Suspense>
    </>
  );
}
