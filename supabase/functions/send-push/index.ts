/**
 * Edge Function „send-push“: verschickt fällige Einträge der notification_outbox
 * über die Expo-Push-API (iOS und Android).
 *
 * Aufruf: nur pg_cron über private.invoke_push_worker(), mit dem Secret Key im
 * apikey-Header (kein Bearer). verify_jwt = false (siehe supabase/config.toml).
 *
 * Ablauf pro Runde:
 *   1. claim_push_batch holt bis zu 100 fällige Einträge samt Push-Tokens.
 *   2. Pro Eintrag und Gerät eine Nachricht, an Expo in Paketen zu 100.
 *   3. finish_push_batch meldet zurück: verschickt, erneut versuchen oder
 *      endgültig fehlgeschlagen; ungültige Tokens (DeviceNotRegistered) werden gelöscht.
 *
 * Texte: Deutsch, Du-Form, Emojis sparsam. Uhrzeiten in Europe/Berlin.
 * (Die Edge-Function-Laufzeit ist Deno und kann @repo/shared nicht importieren,
 * deshalb die kleinen Formatierer hier.)
 *
 * Optional: Secret EXPO_ACCESS_TOKEN, falls „Enhanced Security for Push“ im Expo-Konto aktiv ist.
 * Deploy (ohne Docker): pnpm supabase functions deploy send-push --use-api --no-verify-jwt
 */
import { withSupabase } from 'npm:@supabase/server@1.9.2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo nimmt höchstens 100 Nachrichten pro Anfrage. */
const EXPO_CHUNK = 100;
const CLAIM_LIMIT = 100;
/** Mehr Runden pro Aufruf sind nicht nötig, der Cron-Job läuft jede Minute. */
const MAX_ROUNDS = 5;

/** Fehler, bei denen ein neuer Versuch nichts bringt. */
const PERMANENT_ERRORS = new Set([
  'DeviceNotRegistered',
  'MessageTooBig',
  'InvalidCredentials',
  'MismatchSenderId',
  'PAYLOAD_UNVOLLSTAENDIG',
  'KEIN_GERAET',
]);

type NotificationType = 'neues_angebot' | 'erinnerung' | 'angebot_abgesagt';

interface OutboxRow {
  outbox_id: number;
  notification_type: NotificationType;
  recipient_id: string;
  offer_id: string | null;
  voucher_id: string | null;
  payload: Record<string, unknown> | null;
  attempts: number;
  tokens: string[] | null;
}

interface PushContent {
  title: string;
  body: string;
  /** Pfad in der App (Expo Router), z. B. /angebot/<id> */
  url: string;
}

interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: { url: string; outboxId: number };
  sound: 'default';
  priority: 'high';
  channelId: 'default';
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface Failure {
  id: number;
  error: string;
  retry: boolean;
}

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------

const timeFormat = new Intl.DateTimeFormat('de-DE', {
  timeZone: 'Europe/Berlin',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function berlinTime(value: unknown): string {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? '' : timeFormat.format(date);
}

/** Wie formatDiscount aus @repo/shared: „−40 %“ mit echtem Minus und geschütztem Leerzeichen. */
function discount(value: unknown): string {
  const percent = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(percent) && percent > 0 ? `−${Math.round(percent)} %` : '';
}

/** Titel, Text und Ziel in der App. `null`, wenn Pflichtangaben fehlen. */
export function buildContent(row: OutboxRow): PushContent | null {
  const p = row.payload ?? {};
  const title = text(p.offer_title);
  const location = text(p.location_name);
  if (!title) return null;

  switch (row.notification_type) {
    case 'neues_angebot': {
      if (!row.offer_id) return null;
      const deal = discount(p.discount_percent);
      const byLocation = text(p.reason) === 'standort' && location !== '';
      return {
        title: byLocation ? `Neu bei ${location} ✨` : 'Neuer Deal für dich ✨',
        body: [byLocation ? title : `${title}${location ? ` bei ${location}` : ''}`, deal]
          .filter(Boolean)
          .join(' · '),
        url: `/angebot/${row.offer_id}`,
      };
    }
    case 'erinnerung': {
      if (!row.voucher_id) return null;
      const time = berlinTime(p.starts_at);
      const code = text(p.short_code);
      const start = time ? `startet um ${time}` : 'startet bald';
      return {
        title: 'Gleich geht’s los ⏰',
        body: `${title} ${start}${location ? ` bei ${location}` : ''}.${code ? ` Dein Code: ${code}` : ''}`,
        url: `/code/${row.voucher_id}`,
      };
    }
    case 'angebot_abgesagt': {
      if (!row.voucher_id) return null;
      // Begründung des Anbieters (optional), gekürzt, damit der Push lesbar bleibt
      const reason = text(p.message).slice(0, 120);
      const who = location || 'Der Anbieter';
      return {
        title: `Abgesagt: ${title}`,
        body: `${who} hat abgesagt${reason ? `: „${reason}“` : ''}. Dein Code ist storniert, du musst nichts tun.`,
        url: `/code/${row.voucher_id}`,
      };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Versand
// ---------------------------------------------------------------------------

/** Schickt Nachrichten an Expo. Liefert pro Nachricht ein Ticket (gleiche Reihenfolge). */
async function sendToExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;

  const tickets: ExpoTicket[] = [];
  for (let start = 0; start < messages.length; start += EXPO_CHUNK) {
    const chunk = messages.slice(start, start + EXPO_CHUNK);
    let chunkTickets: ExpoTicket[];
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(chunk),
      });
      const json = (await response.json().catch(() => null)) as {
        data?: ExpoTicket[];
        errors?: { code?: string }[];
      } | null;
      if (!response.ok || !Array.isArray(json?.data) || json.data.length !== chunk.length) {
        const code = json?.errors?.[0]?.code ?? `HTTP_${response.status}`;
        chunkTickets = chunk.map(() => ({ status: 'error', details: { error: code } }));
      } else {
        chunkTickets = json.data;
      }
    } catch {
      chunkTickets = chunk.map(() => ({ status: 'error', details: { error: 'NETZWERK' } }));
    }
    tickets.push(...chunkTickets);
  }
  return tickets;
}

interface RoundResult {
  sentIds: number[];
  failed: Failure[];
  invalidTokens: string[];
}

/** Baut Nachrichten, verschickt sie und wertet die Tickets pro Outbox-Eintrag aus. */
async function deliver(rows: OutboxRow[]): Promise<RoundResult> {
  const result: RoundResult = { sentIds: [], failed: [], invalidTokens: [] };
  const messages: ExpoMessage[] = [];
  const owners: number[] = [];

  for (const row of rows) {
    const content = buildContent(row);
    const tokens = (row.tokens ?? []).filter((token) => token.trim() !== '');
    if (!content) {
      result.failed.push({ id: row.outbox_id, error: 'PAYLOAD_UNVOLLSTAENDIG', retry: false });
      continue;
    }
    if (tokens.length === 0) {
      result.failed.push({ id: row.outbox_id, error: 'KEIN_GERAET', retry: false });
      continue;
    }
    for (const token of tokens) {
      messages.push({
        to: token,
        title: content.title,
        body: content.body,
        data: { url: content.url, outboxId: row.outbox_id },
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      });
      owners.push(row.outbox_id);
    }
  }

  if (messages.length === 0) return result;
  const tickets = await sendToExpo(messages);

  const perRow = new Map<number, { ok: boolean; errors: string[] }>();
  tickets.forEach((ticket, index) => {
    const id = owners[index];
    const message = messages[index];
    if (id === undefined || message === undefined) return;
    const entry = perRow.get(id) ?? { ok: false, errors: [] };
    if (ticket.status === 'ok') {
      entry.ok = true;
    } else {
      const error = ticket.details?.error ?? 'UNBEKANNT';
      entry.errors.push(error);
      if (error === 'DeviceNotRegistered') result.invalidTokens.push(message.to);
    }
    perRow.set(id, entry);
  });

  for (const [id, entry] of perRow) {
    if (entry.ok) {
      result.sentIds.push(id);
      continue;
    }
    const retry = entry.errors.some((error) => !PERMANENT_ERRORS.has(error));
    result.failed.push({ id, error: entry.errors.join(', ').slice(0, 500), retry });
  }
  return result;
}

export default {
  fetch: withSupabase({ auth: 'secret' }, async (_req, ctx) => {
    const totals = { processed: 0, sent: 0, retry: 0, failed: 0, tokens_removed: 0 };

    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const { data, error } = await ctx.supabaseAdmin.rpc('claim_push_batch', {
        p_limit: CLAIM_LIMIT,
      });
      if (error) {
        return Response.json(
          { error: { code: 'CLAIM_FEHLGESCHLAGEN', message: error.message }, ...totals },
          { status: 500 },
        );
      }

      const rows = (data ?? []) as OutboxRow[];
      if (rows.length === 0) break;

      const outcome = await deliver(rows);
      const { data: finished, error: finishError } = await ctx.supabaseAdmin.rpc(
        'finish_push_batch',
        {
          p_sent_ids: outcome.sentIds,
          p_failed: outcome.failed,
          p_invalid_tokens: [...new Set(outcome.invalidTokens)],
        },
      );
      if (finishError) {
        // Die Einträge bleiben auf 'processing' und werden nach 10 Minuten erneut fällig.
        return Response.json(
          { error: { code: 'FINISH_FEHLGESCHLAGEN', message: finishError.message }, ...totals },
          { status: 500 },
        );
      }

      const counts = (finished ?? {}) as Partial<typeof totals>;
      totals.processed += rows.length;
      totals.sent += counts.sent ?? 0;
      totals.retry += counts.retry ?? 0;
      totals.failed += counts.failed ?? 0;
      totals.tokens_removed += counts.tokens_removed ?? 0;

      if (rows.length < CLAIM_LIMIT) break;
    }

    return Response.json(totals);
  }),
};
