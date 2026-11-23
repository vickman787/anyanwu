# Anyanwu — Pay your whole team, in the light

Anyanwu is named for the Eye of the Sun, the Igbo sun god that sees
everything. It is stablecoin payroll for borderless teams, built on QIE.

An employer puts money in a treasury, adds their team, and pays everyone
in one run. Some people are paid monthly, in full. Others are paid as
work happens, through a stream that grows second by second. Every payment
is written to a public record, each entry chained to the one before it,
so anyone can check the record and trust what they see.

Built for the **QIE Hackathon 3.0, Mainnet Edition** — DeFi & Financial
Infrastructure track. Submit by **23:59 CET, Monday 30 November 2026**.
Demo week Dec 1–5, winners Dec 10. $17,000 prize pool.

## What works today

- **Landing** (`/`) — what Anyanwu is, in plain words.
- **Employer dashboard** (`/dashboard`) — connect a wallet (QIE Wallet
  first, any EVM wallet works), add team members, fund a demo treasury,
  run a pay run, watch streams grow, and check the public record.
- **Worker portal** (`/portal`) — paste a wallet address and see what
  that wallet has been paid.
- **Payroll maths** (`packages/shared`) — exact amounts in smallest units,
  no floats; a pay run that either pays everyone or no one.
- **Public record** (`packages/ledger`) — SHA-256 hash-chained entries;
  changing an old payment breaks the chain, and anyone can re-check it.
- **Contracts** (`contracts/`) — `AnyanwuTreasury`, `PayrollBatcher`,
  `StreamVesting`, plus a test-only token. 12 forge tests pass.
- **Scheduled pay runs** — save a run for a date (monthly, weekly, or
  one-off). It only pays when it is due, and the same pay period is
  never paid twice.
- **Pay-run memos + an honest checklist** — every run carries a pay
  period (e.g. "Nov 2026") and a note, stored in the public record and
  shown on the worker portal. Before you pay, the dashboard ticks only
  what it actually checked — and says plainly what it did not check
  (sanctions screening, KYC).
- **Free read API** — `GET /api/reputation/[address]` (what one wallet
  has been paid) and `GET /api/payroll/runs` (recent pay runs). Free to
  read, no sign-in, no payment to call. See "Free read API" below.

The demo runs on **test money in your browser**. The contracts are
**live on QIE mainnet (chain 1990)** since 2026-11-23:

- AnyanwuTreasury — `0x366f7234114C1be6dE95b2DF515890559C5558Ed`
  (tx `0xf3d0ab6cd51b1b4a74bc0a521267832a42e3141ed6b29178591f155a51b47a35`)
- PayrollBatcher — `0x17802a05560bCa3615E6758df066Ac3B420b13A4`
  (tx `0x6870572fcc819ef1caf1f6418a3ad3ef0f0a063bd1f8f69f3a0ea21548855375`)
- StreamVesting — `0x4AE81f7F1eaaEbcD4Fb7605821b2d46DEd6Dd8Eb`
  (tx `0x898da23218a61aedb62cdcd65fe6f599592d33457a09f0aa69459c4fe3b8dab2`)

Token: QUSDC on mainnet (`0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5`,
verified on-chain). The demo buttons still use test money in your
browser — they do not move on-chain money yet. Testnet is skipped:
its faucet is offline and its RPC does not answer from here, and the
hackathon needs mainnet.

## Run it

```bash
pnpm install
pnpm test        # payroll maths + record + contracts
pnpm --filter @anyanwu/web dev   # http://localhost:3000
```

Try the demo: open `/dashboard`, add a person (any name, a wallet like
`0x1111111111111111111111111111111111111111`, pay `250`), add 1,000 test
dollars to the treasury, and run payroll. Then open `/portal` and paste
that wallet to see the payment.

## Judge path (3 minutes)

1. Open the landing page. Read the promise: one treasury, one run pays
   everyone, pay that flows, a record anyone can check.
2. `/dashboard` — add two people (one monthly, one streaming), fund the
   treasury, set the pay period (e.g. "Nov 2026"), run payroll. Watch
   the record grow and press **Check the record** — it reports that
   the chain is clean. Read **Before you pay**: only what was checked
   is ticked, and sanctions/KYC say "Not checked by Anyanwu".
3. Save a schedule for a date in the past — it shows as due, with
   **Run now**. Run it, then try again: the same pay period is refused.
4. `/portal` — paste the first person's wallet. The payment is there,
   with its pay period in the note.
5. `curl` the free read API (no sign-in, no payment):
   `GET /api/reputation/<that wallet>` and `GET /api/payroll/runs`.
6. `contracts/` — read `PayrollBatcher.sol`: one transaction pays the
   whole team, or the whole run fails and nothing moves.
7. `pnpm test` — 12 contract tests plus the payroll-maths, record,
   schedule, checklist, and API tests, all green.

## Free read API

Anyone can read the public record — free, no sign-in, no payment.
This is a read API, not a paid agent API: nobody pays to call it,
and it never moves money.

- `GET /api/reputation/<wallet>` — how many payments that wallet got,
  the exact total paid, the last payment (with its pay-period memo),
  and its streams.
- `GET /api/payroll/runs` — recent pay runs, grouped by pay period,
  with exact totals.
- The dashboard sends its demo record to the server with
  `POST /api/payroll/sync` so these routes can answer for it. That
  endpoint only stores what a visitor's own browser chose to share,
  and the record resets when the server restarts.

## QIE submission checklist

- [ ] Public GitHub repo (this code, fresh — no fork)
- [ ] Live demo URL (deploy `apps/web`, e.g. Vercel)
- [x] Contract addresses on **QIE mainnet** (chain 1990) — deployed
      2026-11-23, see "What works today" above
- [ ] Track: DeFi & Financial Infrastructure
- [ ] Demo video (under 3 minutes, follow the judge path above)
- [ ] A named real team that gets paid for real work, on mainnet

### Before the first real pay run

- [ ] Independent review of `contracts/src/` — the contracts hold
      other people's pay.
- [x] Fresh mainnet-only deployer wallet, funded with **0.02 QIE**
      for gas (deploy is ~3.49M gas: 0.00393 QIE at 1.125 gwei,
      0.00699 QIE at a 2 gwei worst case — simulated, then broadcast
      2026-11-23 for ~0.0027 QIE actual). Never reuse a wallet that
      holds other money.
- [x] Dry-run simulation (done 2026-11-23 — see `docs/qie-notes.md`),
      then the real broadcast:
      `QIE_MAINNET_PRIVATE_KEY=0x... MAINNET=1 I_REVIEWED_MAINNET=1 forge script script/Deploy.s.sol --rpc-url qie --broadcast`
- [x] Paste the printed addresses into `.env`
      (`NEXT_PUBLIC_*_MAINNET`) and verify on https://mainnet.qie.digital.
- [ ] Small first pay run on mainnet, with a small team and a small amount.

Mainnet deploy uses the real QUSDC
(`0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5`, verified on-chain) and
deploys no test token. The deploy script refuses to run on mainnet
unless `I_REVIEWED_MAINNET=1` is set — only after a review.

## What is still NOT built

Deliberately left out — each one needs something Anyanwu does not
have yet, and none of them fit in the days left before Nov 30:

- **Yield on the treasury** — needs a yield venue on QIE and an audit
  of the routing; there is no approved one wired in.
- **Escrow** — needs a new contract plus someone to judge the work;
  no validator is built.
- **Fiat off-ramp / cards** — needs a regulated partner and a licence;
  Anyanwu has no banking partner.
- **Embedded wallets** — people connect their own wallet instead;
  simpler, and no one else holds their keys.
- **KYC / OFAC screening** — no screening provider is wired in, so
  the app says "Not checked by Anyanwu" instead of faking a pass.
- **Paid agent API** — the read API above is free on purpose; charging
  agents would need a payment facilitator on QIE, which is not built.

## What we checked, and what is still open

See `docs/qie-notes.md`. Short version: mainnet chain ID, RPCs,
explorer, gas price, the mainnet QUSDC address, and the QIE ID address
are all verified on-chain from this machine on 2026-11-23. Testnet was
skipped by decision — its faucet is offline and its RPC does not answer
— and QIE ID is not deployed on testnet, so `.qie` names only show on
mainnet, and only when the chain proves the wallet owns one.

## Project layout

```
apps/web/            Next.js app: landing, dashboard, portal
packages/shared/     Payroll maths — exact, deterministic, tested
packages/ledger/     Hash-chained public record (+ Postgres schema)
contracts/           Foundry: treasury, pay-run, streams, test token
docs/                QIE notes: verified facts vs. open questions
```
