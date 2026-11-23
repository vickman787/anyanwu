# QIE notes — what is verified, what is still open

Checked Nov 2026 against qie.digital/developers, the QIE FAQ, the QIE
Wallet MCP docs, and the QIE team's testnet deploy guide. If a fact
below is not from one of those, it says so.

## Verified on mainnet, from this machine (2026-11-23)

| Fact | Value | How checked |
| --- | --- | --- |
| Mainnet chain ID | 1990 (0x7c6) | `eth_chainId` on rpc1mainnet, rpc2mainnet, and mainnet.qie.digital/api/eth-rpc — all three answer |
| Mainnet block | 12,111,833 at check time | `cast block-number` |
| Mainnet gas price | 1.125 gwei (base fee 1 gwei) | `cast gas-price` / `cast base-fee` |
| QUSDC, mainnet | `0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5`, 6 decimals | On-chain: code present, `decimals()` 6, `symbol()`/`name()` "QUSDC", `totalSupply()` 8,929,088,928 |
| QIE ID, mainnet | `0x9aab56e7727af53A3131985BFB16d845319b7bdc` (ERC-721, `.qie` names) | On-chain: code present, `supportsInterface(0x80ac58cd)` true, `name()` "qie", `symbol()` ".qie" |
| QIE Wallet | `window.qie.request({ method: "eth_requestAccounts" })`; non-custodial, keys stay on the device | qie.digital/developers |
| QIEDEX Swap API | https://api.dex.qie.digital (mainnet) | qie.digital/developers |
| Oracle docs | docs.qie.digital/qie-oracle | qie.digital/developers |
| Hackathon | QIE Hackathon 3.0, deadline 23:59 CET Nov 30 2026, demo week Dec 1–5, winners Dec 10; $17k pool; mainnet deployment required | hackathon.qie.digital |
| Hackathon rules | Forked/recycled code, copied projects, simple clones = immediate disqualification, no appeals | hackathon.qie.digital |

## Testnet — skipped by decision (2026-11-23)

The user cannot get test tokens, and the hackathon needs mainnet, so
testnet is skipped and Anyanwu is built mainnet-first. What was seen:

- The faucet (https://www.qie.digital/faucet, 2 test QIE/day) was tried
  twice in the browser on 2026-11-23 and both times answered "The faucet
  is offline right now. Please try again later." No captcha, no wallet
  prompt — nothing for a human to solve. The test wallet
  `0x4F72839506950B254f5988224c64E0c4d1ec5DfE` still holds 0 test QIE.
- The testnet RPC is unreachable from this machine: rpc1testnet timed
  out, rpc2testnet came back empty, testnet.qie.digital/api/eth-rpc
  answered "Balance not found". Mainnet RPC, by contrast, answers
  every time (see above).
- No QUSDC address is published for testnet, and QIE ID is not
  deployed on testnet (the QIE Wallet MCP docs say lookups on chain
  1983 return "unresolved"). The app therefore never shows a `.qie`
  name on testnet, and the test token (`contracts/src/MockQUSDC.sol`)
  is never used on mainnet.

## Mainnet deploy — simulated, not broadcast (2026-11-23)

`MAINNET=1 I_REVIEWED_MAINNET=1 forge script script/Deploy.s.sol
--rpc-url qie` ran clean against mainnet state. Nothing was broadcast
and no money moved. The simulated run:

- Uses the real QUSDC (`0x3F43DA82…A5DA5`) and deploys **no** test token.
- Simulated addresses (dry-run only — the real deploy will print
  different ones): Treasury `0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519`,
  Batcher `0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496`,
  Stream `0x34A1D3fff3958843C43aD80F30b94c510645C316`.
- **Total gas: 3,493,517** for all three contracts. At the live gas
  price of 1.125 gwei that is **0.00393 QIE**; at forge's worst-case
  estimate of 2 gwei it is **0.00699 QIE**. Fund the deployer with
  **0.02 QIE** so a price spike cannot strand the deploy — the extra
  stays in the deployer's wallet.
- The deploy script refuses a mainnet run unless `I_REVIEWED_MAINNET=1`
  is set. That flag is only to be set after an independent review.
  Verified: without it, the script reverts with a clear message.

Real deploy (only after review, funding, and the user's approval):

```bash
# 1. Fresh mainnet-only deployer wallet, funded with 0.02 QIE for gas.
#    Never reuse a wallet that holds other money. Never commit the key.
QIE_MAINNET_PRIVATE_KEY=0x... MAINNET=1 I_REVIEWED_MAINNET=1 \
  forge script script/Deploy.s.sol --rpc-url qie --broadcast
# 2. Paste the printed addresses into .env (NEXT_PUBLIC_*_MAINNET).
# 3. Verify on https://mainnet.qie.digital, then do a small first
#    pay run with a small team and a small amount.
```

## Still open — do not guess these

1. **QIEDEX / Oracle integration is not built yet.** The APIs are
   listed above and the deploy script leaves room for them, but v1
   does not call them. That is a named next step, not a hidden gap.
2. **No independent contract review yet.** The contracts hold other
   people's pay. Review `contracts/src/` before any mainnet broadcast.
3. **No named real team yet, no live demo URL, no demo video.**
   All three are needed for the submission (see README checklist).

## How the app uses QIE today

- Wallet connect: QIE Wallet (`window.qie`) first, any EVM wallet as
  a fallback. Network add/switch for chains 1990 (default) and 1983.
- Stablecoin: real QUSDC address on mainnet; test token on testnet only.
- Identity: QIE ID `balanceOf` check on mainnet only, honest "holds a
  name / holds no name" answer, never a guessed name.
- Explorer links: every address links to the right explorer for its
  network.
