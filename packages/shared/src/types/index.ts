/**
 * Typen aus der Datenbank. `database.types.ts` wird mit `pnpm db:types`
 * erzeugt und nie von Hand geändert. Hier stehen nur bequeme Kurzformen.
 *
 * @example
 *   const supabase = createClient<Database>(url, key);
 *   type Offer = Tables<'offers'>;
 *   type Feed = RpcReturns<'list_offers'>;
 */
import type { Database } from './database.types';

export type { Database, Json } from './database.types';
export { Constants } from './database.types';

type PublicSchema = Database['public'];

/** Zeile einer Tabelle, z. B. `Tables<'offers'>`. */
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];

/** Werte eines Enums, z. B. `Enums<'voucher_status'>`. */
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

/** Name einer RPC. */
export type RpcName = keyof PublicSchema['Functions'];

/** Parameter einer RPC, z. B. `RpcArgs<'claim_voucher'>` → `{ p_offer_id: string; p_seats?: number }`. */
export type RpcArgs<T extends RpcName> = PublicSchema['Functions'][T]['Args'];

/** Rückgabe einer RPC. Tabellen-Funktionen liefern ein Array. */
export type RpcReturns<T extends RpcName> = PublicSchema['Functions'][T]['Returns'];

/** Ein Element der Rückgabe, z. B. `RpcRow<'list_offers'>` für eine Feed-Karte. */
export type RpcRow<T extends RpcName> =
  RpcReturns<T> extends readonly (infer Row)[] ? Row : RpcReturns<T>;
