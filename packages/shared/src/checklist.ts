/**
 * @anyanwu/shared — the "before you pay" checklist. Pure functions only.
 *
 * The checklist ticks only what the app actually checked, in plain
 * words. It never claims a check ran when it did not:
 * - Sanctions screening and identity/KYC checks are NOT done by
 *   Anyanwu, so they are always shown as "Not checked by Anyanwu" —
 *   never as passed, never as failed, just not checked.
 * - Holding a .qie name is information, not a pass/fail test: a wallet
 *   without a name can still be paid. What matters is that the check
 *   itself ran and answered.
 */
export interface ChecklistInput {
  /** A wallet is connected in this browser. */
  walletConnected: boolean;
  /** holdsQieId() was called and answered (mainnet only; testnet has no QIE ID). */
  qieIdChecked: boolean;
  /** The connected wallet holds a .qie name. Only meaningful when qieIdChecked is true. */
  qieIdHoldsName: boolean;
  /** The treasury holds enough to cover the whole run. */
  treasuryCoversRun: boolean;
  /** Every team member's wallet passed validation (planPayroll checks this). */
  addressesValid: boolean;
  /** Amounts are exact smallest-unit maths (bigint), never floats. Always true in this app. */
  amountsExact: boolean;
}

export type ChecklistStatus = "passed" | "failed" | "not-checked";

export interface ChecklistItem {
  label: string;
  status: ChecklistStatus;
  detail: string;
}

export function buildChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    {
      label: "Wallet connected",
      status: input.walletConnected ? "passed" : "failed",
      detail: input.walletConnected
        ? "A wallet is connected in this browser."
        : "Connect a wallet first — the run is paid from it.",
    },
    {
      label: ".qie name checked",
      status: input.qieIdChecked ? "passed" : "not-checked",
      detail: !input.qieIdChecked
        ? "Not checked yet — connect a wallet on mainnet and the app checks it."
        : input.qieIdHoldsName
          ? "Checked — this wallet holds a .qie name."
          : "Checked — this wallet holds no .qie name yet. It can still be paid.",
    },
    {
      label: "Treasury covers the run",
      status: input.treasuryCoversRun ? "passed" : "failed",
      detail: input.treasuryCoversRun
        ? "The treasury holds enough for the whole run."
        : "The treasury does not hold enough for the whole run — fund it first.",
    },
    {
      label: "Addresses are valid",
      status: input.addressesValid ? "passed" : "failed",
      detail: input.addressesValid
        ? "Every team member's wallet looks like a real QIE address."
        : "One or more team members have a wallet the app cannot use — check the team list.",
    },
    {
      label: "Amounts are exact",
      status: input.amountsExact ? "passed" : "failed",
      detail: input.amountsExact
        ? "Every amount is counted in the coin's smallest units — no rounding, no floats."
        : "Amounts could not be counted exactly — the run is stopped.",
    },
    {
      label: "Sanctions screening",
      status: "not-checked",
      detail: "Not checked by Anyanwu — no sanctions list is screened. Pay only people you know.",
    },
    {
      label: "Identity (KYC) checks",
      status: "not-checked",
      detail: "Not checked by Anyanwu — no identity documents are collected or verified.",
    },
  ];
}

/** True when every check that ran passed. "Not checked" items never block a run — they are shown, not hidden. */
export function checklistReady(items: readonly ChecklistItem[]): boolean {
  return items.every((item) => item.status !== "failed");
}
