export type FixAction = "switch-network" | "get-tokens" | "get-gas" | "connect-wallet" | "edit-connection" | "enable-usdc" | "retry";

export interface FriendlyError {
  title: string;
  message: string;
  funds: string;
  action?: { kind: FixAction; label: string };
  code: string;
  detail: string;
}

export interface ErrorContext {
  walletName: string;
  networkName: string;
  asset: string;
  submitted: boolean;
  needed?: string;
  have?: string;
}

export function errorCode(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string") return code;
  if (code === 4001) return "WALLET_REJECTED";
  return "UNKNOWN";
}

export function friendlyError(e: unknown, ctx: ErrorContext): FriendlyError {
  const code = errorCode(e);
  const detail = String((e as Error)?.message ?? e);
  const noFunds = "No funds were sent.";
  const unsure = "The transaction may have reached the network. Check the explorer before trying again.";
  const base = { code, detail };

  switch (code) {
    case "WALLET_REJECTED":
      return { ...base, title: "Payment cancelled", message: `You rejected the request in ${ctx.walletName}.`, funds: noFunds, action: { kind: "retry", label: "Try again" } };
    case "APPROVAL_REJECTED":
      return { ...base, title: "Payment cancelled", message: `You declined permission to spend ${ctx.asset} in ${ctx.walletName}.`, funds: noFunds, action: { kind: "retry", label: "Try again" } };
    case "WRONG_NETWORK":
      return { ...base, title: "Wrong network", message: `Your wallet isn't on ${ctx.networkName}.`, funds: noFunds, action: { kind: "switch-network", label: `Switch to ${ctx.networkName}` } };
    case "INSUFFICIENT_BALANCE":
      return {
        ...base,
        title: `Not enough ${ctx.asset}`,
        message: ctx.needed ? `You need ${ctx.needed} ${ctx.asset} plus a small network fee${ctx.have ? `, but your wallet has ${ctx.have}` : ""}.` : `Your wallet doesn't have enough ${ctx.asset} for this payment and its network fee.`,
        funds: noFunds,
        action: { kind: "get-tokens", label: `Get test ${ctx.asset}` },
      };
    case "INVALID_KEY":
      return { ...base, title: "API key not accepted", message: "The API key is invalid, expired, or doesn't cover this network or token.", funds: noFunds, action: { kind: "edit-connection", label: "Edit connection" } };
    case "MERCHANT_NOT_FOUND":
      return { ...base, title: "Merchant not found", message: "The vendor ID is wrong, or the merchant is inactive.", funds: noFunds, action: { kind: "edit-connection", label: "Edit connection" } };
    case "NETWORK_NOT_ENABLED":
      return { ...base, title: "Network not enabled", message: `This merchant hasn't enabled ${ctx.networkName}, or has no wallet set up for it.`, funds: noFunds };
    case "TOKEN_NOT_SUPPORTED":
      return { ...base, title: `${ctx.asset} isn't available`, message: `This merchant doesn't accept ${ctx.asset} on ${ctx.networkName}. Pick another token.`, funds: noFunds };
    case "QUOTE_EXPIRED":
    case "QUOTE_USED":
    case "QUOTE_NOT_FOUND":
      return { ...base, title: "Price expired", message: "The price quote is no longer valid. Send the payment again to get a fresh price.", funds: noFunds, action: { kind: "retry", label: "Try again" } };
    case "NETWORK_ERROR":
      return { ...base, title: "Connection problem", message: `We couldn't reach KwesPay or the ${ctx.networkName} network.`, funds: ctx.submitted ? unsure : noFunds, action: { kind: "retry", label: "Try again" } };
    case "CONTRACT_ERROR":
      return {
        ...base,
        title: "Payment rejected",
        message: "The KwesPay payment contract rejected this transaction.",
        funds: ctx.submitted ? "No payment was taken. You may have paid a small network fee." : noFunds,
        action: { kind: "retry", label: "Try again" },
      };
    case "TRANSACTION_FAILED":
      return { ...base, title: "Payment couldn't be sent", message: "The transaction failed before it could complete.", funds: ctx.submitted ? unsure : noFunds, action: { kind: "retry", label: "Try again" } };
    default:
      if (/Cannot query field/i.test(detail))
        return { ...base, code: "BACKEND_OUTDATED", title: "Backend is older than the SDK", message: "This KwesPay backend doesn't support a field the SDK requested. Deploy the latest backend or point the console at an up-to-date one.", funds: noFunds };
      return { ...base, title: "Payment couldn't be completed", message: detail.length > 220 ? `${detail.slice(0, 220)}…` : detail, funds: ctx.submitted ? unsure : noFunds, action: { kind: "retry", label: "Try again" } };
  }
}
