/**
 * The public record, as the server sees it. The demo lives in each
 * visitor's browser, so the dashboard sends its record here with
 * POST /api/payroll/sync (fire-and-forget — the demo works even when
 * the sync fails). The free read routes below only ever read this
 * store; they never write to it and never move money.
 *
 * This is in-memory on purpose: it is a demo record, not a database.
 * It resets when the server restarts, and it holds only what a
 * visitor's browser chose to share — the same entries their own
 * dashboard shows.
 */
import type { LedgerEntry } from "@anyanwu/ledger";
import type { DemoStream } from "./demo";

export interface PublicRecord {
  ledger: LedgerEntry[];
  streams: DemoStream[];
}

let record: PublicRecord = { ledger: [], streams: [] };

export function getPublicRecord(): PublicRecord {
  return record;
}

export function setPublicRecord(next: PublicRecord): void {
  record = { ledger: [...next.ledger], streams: [...next.streams] };
}
