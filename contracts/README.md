# Contracts

Three small contracts, written fresh for QIE. No proxies, no admin keys
beyond the employer's own treasury.

| Contract | What it does |
| --- | --- |
| `AnyanwuTreasury.sol` | One employer's money box. Only the employer can fund it, withdraw from it, or send money to the pay-run contract. |
| `PayrollBatcher.sol` | Pays a whole team in one transaction. Either everyone in the list is paid, or the whole run fails and nothing moves. |
| `StreamVesting.sol` | Pay that flows while work happens. Locked up front, grows in a straight line, waits out a cliff, claimed any time. |
| `MockQUSDC.sol` | A test dollar (6 decimals, like real QUSDC). Testnet only, anyone can mint it, worth nothing. Never deploy to mainnet. |

## Setup

```bash
forge install   # fetches forge-std (a git submodule, not committed)
forge test
```

## Deploy — mainnet first

Testnet is skipped: its faucet is offline and its RPC does not answer
from here, and the hackathon needs mainnet.

**Deployed on QIE mainnet (chain 1990) on 2026-11-23, verified on-chain:**
- `AnyanwuTreasury` — `0x366f7234114C1be6dE95b2DF515890559C5558Ed` (tx `0xf3d0ab6cd51b1b4a74bc0a521267832a42e3141ed6b29178591f155a51b47a35`)
- `PayrollBatcher` — `0x17802a05560bCa3615E6758df066Ac3B420b13A4` (tx `0x6870572fcc819ef1caf1f6418a3ad3ef0f0a063bd1f8f69f3a0ea21548855375`)
- `StreamVesting` — `0x4AE81f7F1eaaEbcD4Fb7605821b2d46DEd6Dd8Eb` (tx `0x898da23218a61aedb62cdcd65fe6f599592d33457a09f0aa69459c4fe3b8dab2`)

The deploy was first simulated against mainnet on 2026-11-23 (`MAINNET=1 I_REVIEWED_MAINNET=1 forge
script script/Deploy.s.sol --rpc-url qie`, no `--broadcast`): it uses
the real QUSDC and deploys no test token. Total gas 3,493,517 —
0.00393 QIE at the live 1.125 gwei, 0.00699 QIE at a 2 gwei worst case.
Fund the deployer with 0.02 QIE. Actual cost was ~0.0027 QIE.

Only after an independent review of `src/`, and only with the user's
approval:

```bash
QIE_MAINNET_PRIVATE_KEY=0x... MAINNET=1 I_REVIEWED_MAINNET=1 \
  forge script script/Deploy.s.sol --rpc-url qie --broadcast
```

The script refuses a mainnet run unless `I_REVIEWED_MAINNET=1` is set.
Then paste the printed addresses into `.env`
(`NEXT_PUBLIC_*_MAINNET`) and verify on https://mainnet.qie.digital.
Do a small first pay run, with a small team and a small amount.

Mainnet uses the real QUSDC at
`0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5` (verified on-chain:
decimals 6, symbol/name "QUSDC") and deploys no test token.
