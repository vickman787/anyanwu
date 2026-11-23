-- Anyanwu ledger — the public record, stored in Postgres when DATABASE_URL
-- is set. The app works without a database (in-memory chain), but a shared
-- database is what keeps the record honest across restarts. Amounts are
-- whole numbers of smallest units, kept as text so no precision is lost.
create table if not exists ledger_entries (
  seq integer primary key,
  prev_hash text not null,
  hash text not null,
  type text not null,
  actor text not null,
  counterparty text,
  amount_units text not null,
  memo text not null default '',
  created_at timestamptz not null
);
create index if not exists ledger_entries_hash_idx on ledger_entries (hash);
