/**
 * QIE network facts. Checked against qie.digital/developers and the QIE
 * docs (Nov 2026):
 * - Testnet: chain 1983 (0x7bf), RPC https://rpc1testnet.qie.digital,
 *   explorer https://testnet.qie.digital, faucet qie.digital/faucet.
 * - Mainnet: chain 1990 (0x7c6), RPC https://rpc1mainnet.qie.digital,
 *   explorer https://mainnet.qie.digital. Mainnet is the default: testnet
 *   was skipped (faucet offline, RPC unanswered, hackathon needs mainnet).
 * - QUSDC (the QIE stablecoin, 6 decimals) on mainnet:
 *   0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5. Verified on-chain from this
 *   machine on 2026-11-23 (block 12,111,833): code present, decimals 6,
 *   symbol and name "QUSDC", totalSupply 8,929,088,928.
 * - QIE ID (.qie names) on mainnet:
 *   0x9aab56e7727af53A3131985BFB16d845319b7bdc. Verified on-chain on
 *   2026-11-23: code present, supports ERC-721, name "qie", symbol ".qie".
 *   It is NOT deployed on testnet, so names never show there.
 * - No QUSDC address is published for testnet. Until QIE publishes one,
 *   testnet uses our own test token (see contracts/src/MockQUSDC.sol) and
 *   `tokenAddress("testnet")` returns null on purpose — never guess one.
 */

export type QieNetwork = "testnet" | "mainnet";

export interface QieChain {
  id: number;
  hex: string;
  name: string;
  rpcUrl: string;
  explorer: string;
  currency: string;
}

export const QIE_TESTNET: QieChain = {
  id: 1983,
  hex: "0x7bf",
  name: "QIE Testnet",
  rpcUrl: process.env.NEXT_PUBLIC_QIE_TESTNET_RPC_URL ?? "https://rpc1testnet.qie.digital",
  explorer: "https://testnet.qie.digital",
  currency: "QIE",
};

export const QIE_MAINNET: QieChain = {
  id: 1990,
  hex: "0x7c6",
  name: "QIE Mainnet",
  rpcUrl: process.env.NEXT_PUBLIC_QIE_MAINNET_RPC_URL ?? "https://rpc1mainnet.qie.digital",
  explorer: "https://mainnet.qie.digital",
  currency: "QIE",
};

export const QUSDC_MAINNET = "0x3F43DA82eC9A4f5285F10FaF1F26EcA7319E5DA5";
export const QIE_ID_MAINNET = "0x9aab56e7727af53A3131985BFB16d845319b7bdc";
export const QUSDC_DECIMALS = 6;

/** The stablecoin to pay with on this network, or null when there is none yet. */
export function tokenAddress(network: QieNetwork): string | null {
  if (network === "mainnet") return QUSDC_MAINNET;
  return process.env.NEXT_PUBLIC_QUSDC_TESTNET || null;
}

export function chainFor(network: QieNetwork): QieChain {
  return network === "mainnet" ? QIE_MAINNET : QIE_TESTNET;
}

declare global {
  interface Window {
    qie?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
    ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  }
}

function walletProvider() {
  if (typeof window === "undefined") return null;
  // QIE Wallet exposes window.qie; any EVM wallet exposes window.ethereum.
  return window.qie ?? window.ethereum ?? null;
}

/** Connect with QIE Wallet (or any EVM wallet). Returns the first account. */
export async function connectWallet(): Promise<string> {
  const provider = walletProvider();
  if (!provider) throw new Error("No wallet found. Install QIE Wallet or MetaMask first.");
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts[0]) throw new Error("No account was shared by the wallet.");
  return accounts[0];
}

/** Ask the wallet to switch to a QIE network, adding it if it is missing. */
export async function switchToQie(network: QieNetwork): Promise<void> {
  const provider = walletProvider();
  if (!provider) throw new Error("No wallet found.");
  const chain = chainFor(network);
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chain.hex }] });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chain.hex,
          chainName: chain.name,
          rpcUrls: [chain.rpcUrl],
          blockExplorerUrls: [chain.explorer],
          nativeCurrency: { name: "QIE", symbol: "QIE", decimals: 18 },
        },
      ],
    });
  }
}

/** Read the chain the wallet is on right now, or null when not connected. */
export async function currentChainId(): Promise<number | null> {
  const provider = walletProvider();
  if (!provider) return null;
  try {
    const hex = (await provider.request({ method: "eth_chainId" })) as string;
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

/**
 * Does this wallet hold a .qie name? Honest answer only:
 * - On testnet, QIE ID is not deployed, so the answer is always "not here".
 * - On mainnet, we read the QIE ID contract's balanceOf. That says whether
 *   the wallet holds a name, not what the name is — the name itself lives
 *   in the registration transaction, so we never invent one. When a name
 *   is held, the app links to the explorer where it can be seen.
 */
export async function holdsQieId(
  address: string,
  network: QieNetwork,
): Promise<{ supported: boolean; holdsName: boolean; note: string }> {
  if (network === "testnet") {
    return { supported: false, holdsName: false, note: "QIE ID is not on testnet — names only show on mainnet." };
  }
  try {
    const padded = address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
    const data = await rpcCall<string>(QIE_MAINNET.rpcUrl, "eth_call", [
      { to: QIE_ID_MAINNET, data: `0x70a08231${padded}` },
      "latest",
    ]);
    const holdsName = BigInt(data) > 0n;
    return {
      supported: true,
      holdsName,
      note: holdsName
        ? "This wallet holds a .qie name. See it on the mainnet explorer."
        : "This wallet holds no .qie name yet. Get one at id.qie.digital.",
    };
  } catch {
    return { supported: true, holdsName: false, note: "Could not reach the QIE ID contract just now — try again." };
  }
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerAddress(network: QieNetwork, address: string): string {
  return `${chainFor(network).explorer}/address/${address}`;
}
