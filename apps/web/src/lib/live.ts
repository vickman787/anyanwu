/**
 * Live on-chain payroll on QIE mainnet — no new dependencies.
 *
 * The dashboard demo runs on test money in the browser. This module is
 * the real thing: it talks to the deployed contracts through the user's
 * own wallet (QIE Wallet or any EVM wallet) with plain JSON-RPC calls,
 * the same way `qie.ts` already reads the chain. Every function selector
 * below was checked against `cast sig` on 2026-11-23, and the
 * `runPayroll` encoding is tested against `cast calldata` output.
 *
 * Two honest limits, stated here so the UI can repeat them:
 * - A pay run pays from the employer's connected wallet through the
 *   pay-run contract (approve QUSDC to the Batcher, then runPayroll
 *   pulls it). It does not pull from the treasury.
 * - Only the wallet that deployed the treasury (its owner) can move
 *   money out of the treasury or send it to a pay run. Funding the
 *   treasury from any other wallet parks money there until the owner
 *   moves it — the UI must say so before anyone funds it.
 */

import { chainFor, QIE_MAINNET, QUSDC_MAINNET } from "./qie";

export const TREASURY_MAINNET =
  process.env.NEXT_PUBLIC_TREASURY_MAINNET ??
  "0x366f7234114C1be6dE95b2DF515890559C5558Ed";
export const BATCHER_MAINNET =
  process.env.NEXT_PUBLIC_BATCHER_MAINNET ??
  "0x17802a05560bCa3615E6758df066Ac3B420b13A4";
export const STREAM_MAINNET =
  process.env.NEXT_PUBLIC_STREAM_MAINNET ??
  "0x4AE81f7F1eaaEbcD4Fb7605821b2d46DEd6Dd8Eb";

/** First 4 bytes of keccak256(signature), checked with `cast sig`. */
export const SELECTORS = {
  approve: "0x095ea7b3",
  allowance: "0xdd62ed3e",
  balanceOf: "0x70a08231",
  fund: "0xca1d209d",
  runPayroll: "0x79b0c43e",
  balance: "0xb69ef8a8",
  runCount: "0x9196b700",
} as const;

/** keccak256("PayRun(uint256,address,uint256,uint256,bytes32)"), checked with `cast keccak`. */
export const PAY_RUN_TOPIC =
  "0x4e066d8b21a8308ab575bb294c8c7fed65cf213f0d6decc8ce90374c69a7bd93";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function assertAddress(value: string): string {
  if (!ADDRESS_RE.test(value)) throw new Error(`${value} is not a wallet address.`);
  return value.toLowerCase();
}

function pad32(hex: string): string {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

export function encodeUint256(value: bigint): string {
  if (value < 0n) throw new Error("An amount cannot be negative.");
  return pad32(value.toString(16));
}

export function encodeAddress(value: string): string {
  return pad32(assertAddress(value));
}

/**
 * A short note as bytes32, the way Solidity stores it. The pay period
 * ("Nov 2026") fits; anything over 31 bytes is refused rather than cut
 * off silently, so a run is never labelled with half a note.
 */
export function noteToBytes32(note: string): string {
  const bytes = new TextEncoder().encode(note);
  if (bytes.length > 31) throw new Error("That note is too long for one pay run — keep it under 31 characters.");
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex.padEnd(64, "0")}`;
}

export function encodeApprove(spender: string, amount: bigint): string {
  return `${SELECTORS.approve}${encodeAddress(spender)}${encodeUint256(amount)}`;
}

export function encodeAllowance(owner: string, spender: string): string {
  return `${SELECTORS.allowance}${encodeAddress(owner)}${encodeAddress(spender)}`;
}

export function encodeBalanceOf(account: string): string {
  return `${SELECTORS.balanceOf}${encodeAddress(account)}`;
}

export function encodeFund(amount: bigint): string {
  return `${SELECTORS.fund}${encodeUint256(amount)}`;
}

export function encodeBalance(): string {
  return SELECTORS.balance;
}

export function encodeRunCount(): string {
  return SELECTORS.runCount;
}

/**
 * runPayroll(address[],uint256[],bytes32). The two lists are dynamic,
 * so the call carries an offset to each list, then each list's length
 * and items; the note sits in its own fixed slot after them.
 */
export function encodeRunPayroll(
  recipients: string[],
  amounts: bigint[],
  note: string,
): string {
  if (recipients.length === 0) throw new Error("A pay run needs at least one person.");
  if (recipients.length !== amounts.length) throw new Error("People and amounts do not line up.");
  const head = `${encodeUint256(96n)}${encodeUint256(96n + 32n + BigInt(recipients.length) * 32n)}${noteToBytes32(note).slice(2)}`;
  const list = (items: string[]) =>
    `${encodeUint256(BigInt(items.length))}${items.join("")}`;
  const recipientsPart = list(recipients.map((r) => encodeAddress(r)));
  const amountsPart = list(amounts.map((a) => encodeUint256(a)));
  return `${SELECTORS.runPayroll}${head}${recipientsPart}${amountsPart}`;
}

export function liveTxUrl(hash: string): string {
  return `${QIE_MAINNET.explorer}/tx/${hash}`;
}

export function liveAddressUrl(address: string): string {
  return `${QIE_MAINNET.explorer}/address/${address}`;
}

interface RpcResponse<T> {
  result?: T;
  error?: { message: string };
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(chainFor("mainnet").rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as RpcResponse<T>;
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

async function ethCall(to: string, data: string): Promise<bigint> {
  const hex = await rpcCall<string>("eth_call", [{ to, data }, "latest"]);
  return BigInt(hex);
}

export interface LiveBalances {
  treasuryUnits: bigint;
  batcherUnits: bigint;
  myQusdcUnits: bigint | null;
  allowanceBatcherUnits: bigint | null;
  allowanceTreasuryUnits: bigint | null;
}

/** Read the live balances: treasury, pay-run contract, and the wallet's QUSDC. */
export async function readLiveBalances(wallet?: string | null): Promise<LiveBalances> {
  // The treasury has its own balance() view. The pay-run contract does
  // not — its balance is the token's balanceOf it. (Calling balance()
  // on the Batcher reverts; checked against mainnet 2026-11-23.)
  const treasuryUnits = await ethCall(TREASURY_MAINNET, encodeBalance());
  const batcherUnits = await ethCall(QUSDC_MAINNET, encodeBalanceOf(BATCHER_MAINNET));
  if (!wallet) {
    return { treasuryUnits, batcherUnits, myQusdcUnits: null, allowanceBatcherUnits: null, allowanceTreasuryUnits: null };
  }
  const owner = assertAddress(wallet);
  const myQusdcUnits = await ethCall(QUSDC_MAINNET, encodeBalanceOf(owner));
  const allowanceBatcherUnits = await ethCall(QUSDC_MAINNET, encodeAllowance(owner, BATCHER_MAINNET));
  const allowanceTreasuryUnits = await ethCall(QUSDC_MAINNET, encodeAllowance(owner, TREASURY_MAINNET));
  return { treasuryUnits, batcherUnits, myQusdcUnits, allowanceBatcherUnits, allowanceTreasuryUnits };
}

declare global {
  interface Window {
    qie?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

function walletProvider() {
  if (typeof window === "undefined") return null;
  return window.qie ?? window.ethereum ?? null;
}

/** Send one transaction from the user's wallet. Returns the tx hash. */
export async function sendLiveTransaction(to: string, data: string, from: string): Promise<string> {
  const provider = walletProvider();
  if (!provider) throw new Error("No wallet found. Install QIE Wallet or MetaMask first.");
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to, data }],
  })) as string;
  return hash;
}

export interface TxReceiptLog {
  address: string;
  topics: string[];
  data: string;
}

export interface TxReceipt {
  status: string;
  logs: TxReceiptLog[];
}

/** Wait for a transaction to be mined. Throws when it fails on-chain. */
export async function waitForReceipt(hash: string, timeoutMs = 120_000): Promise<TxReceipt> {
  const started = Date.now();
  for (;;) {
    const receipt = await rpcCall<TxReceipt | null>("eth_getTransactionReceipt", [hash]);
    if (receipt) {
      if (receipt.status !== "0x1") throw new Error(`That transaction failed on-chain (${hash}). Nothing moved.`);
      return receipt;
    }
    if (Date.now() - started > timeoutMs) throw new Error(`Still waiting on ${hash} after two minutes — check the explorer.`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}

/** The run number from a pay-run receipt's PayRun event, or null when it is not there. */
export function parsePayRunId(receipt: TxReceipt, batcher: string): bigint | null {
  const want = batcher.toLowerCase();
  for (const log of receipt.logs ?? []) {
    if (log.address.toLowerCase() !== want) continue;
    if ((log.topics?.[0] ?? "").toLowerCase() !== PAY_RUN_TOPIC) continue;
    return BigInt(log.topics[1]);
  }
  return null;
}

async function approveIfNeeded(
  from: string,
  spender: string,
  amount: bigint,
  currentAllowance: bigint | null,
  onStep: (step: string) => void,
): Promise<string | null> {
  if (currentAllowance !== null && currentAllowance >= amount) return null;
  onStep("Approve the spend in your wallet…");
  const hash = await sendLiveTransaction(QUSDC_MAINNET, encodeApprove(spender, amount), from);
  onStep("Waiting for the approval to land on-chain…");
  await waitForReceipt(hash);
  return hash;
}

/**
 * Fund the treasury with real QUSDC. Two wallet confirmations: approve,
 * then fund. Returns both tx hashes. Only the treasury's owner can move
 * money back out — the dashboard must say that before this runs.
 */
export async function fundTreasuryLive(
  from: string,
  amountUnits: bigint,
  onStep: (step: string) => void,
): Promise<{ approveHash: string | null; fundHash: string }> {
  if (amountUnits <= 0n) throw new Error("Fund it with more than zero.");
  const balances = await readLiveBalances(from);
  if (balances.myQusdcUnits !== null && balances.myQusdcUnits < amountUnits) {
    throw new Error("Your wallet does not hold that much QUSDC.");
  }
  const approveHash = await approveIfNeeded(from, TREASURY_MAINNET, amountUnits, balances.allowanceTreasuryUnits, onStep);
  onStep("Confirm funding the treasury in your wallet…");
  const fundHash = await sendLiveTransaction(TREASURY_MAINNET, encodeFund(amountUnits), from);
  onStep("Waiting for the funding to land on-chain…");
  await waitForReceipt(fundHash);
  return { approveHash, fundHash };
}

/**
 * Pay the whole team in one live transaction. Two wallet confirmations:
 * approve the pay-run contract for the total, then run payroll — the
 * contract pulls the total from the employer's wallet and pays everyone,
 * or the whole run fails and nothing moves. Returns the tx hash and the
 * run number from the PayRun event.
 */
export async function runPayrollLive(
  from: string,
  recipients: string[],
  amounts: bigint[],
  note: string,
  onStep: (step: string) => void,
): Promise<{ approveHash: string | null; txHash: string; runId: bigint | null }> {
  if (recipients.length === 0) throw new Error("A pay run needs at least one person.");
  if (recipients.length !== amounts.length) throw new Error("People and amounts do not line up.");
  const total = amounts.reduce((a, b) => a + b, 0n);
  if (total <= 0n) throw new Error("A pay run needs an amount above zero.");
  const balances = await readLiveBalances(from);
  if (balances.myQusdcUnits !== null && balances.myQusdcUnits < total) {
    throw new Error("Your wallet does not hold enough QUSDC for this run.");
  }
  const approveHash = await approveIfNeeded(from, BATCHER_MAINNET, total, balances.allowanceBatcherUnits, onStep);
  onStep("Confirm the pay run in your wallet…");
  const txHash = await sendLiveTransaction(BATCHER_MAINNET, encodeRunPayroll(recipients, amounts, note), from);
  onStep("Waiting for the pay run to land on-chain…");
  const receipt = await waitForReceipt(txHash);
  return { approveHash, txHash, runId: parsePayRunId(receipt, BATCHER_MAINNET) };
}
