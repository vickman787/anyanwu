# Security

Anyanwu moves money, so treat it like money.

- Never commit a private key, seed phrase, or `.env` file. The demo needs
  no secrets at all.
- Testnet keys are for testnet only. Never reuse a wallet that holds real
  money for development or deployment.
- The demo in `apps/web` runs on test money in your own browser. Nothing
  moves on-chain until the contracts in `contracts/` are deployed and the
  addresses are set in `.env`.
- The contracts hold other people's pay. Do not deploy them to mainnet
  without an independent review of `contracts/src/`, and start with a
  small team and a small amount.
- Found a bug that could lose pay? Do not open a public issue. Tell the
  maintainer directly and give time to fix it before it is shared.
