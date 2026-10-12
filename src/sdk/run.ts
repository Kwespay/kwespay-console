import { KwesPayClient, type MerchantConfig, type PayParams, type QuoteParams, type QuoteResult, type TransactionPayload, type ValidateKeyResult } from "@kwespay/client";
import { createTracer, step } from "./trace";
import type { Credentials, Run, Step } from "./types";

export type { Credentials, LogLine, Phase, Run, Step, StepState } from "./types";

export function makeClient(c: Credentials): KwesPayClient {
  return new KwesPayClient({ apiKey: c.apiKey, graphqlEndpoint: c.endpoint });
}

export interface AccountResult {
  key: ValidateKeyResult;
  merchant: MerchantConfig;
  steps: Step[];
}

export async function connectAccount(c: Credentials): Promise<AccountResult> {
  const kwespay = makeClient(c);
  const steps: Step[] = [];

  const key = await timed(steps, step("validateKey", "Validate API key", "validateKey()"), { vendorIdentifier: c.vendorId }, () => kwespay.validateKey(c.vendorId));
  if (!key.isValid) {
    steps[steps.length - 1].state = "failed";
    throw Object.assign(new Error(key.error), { code: "INVALID_KEY" });
  }

  const merchant = await timed(steps, step("getMerchantConfig", "Load merchant settings", "getMerchantConfig()"), { vendorIdentifier: c.vendorId }, () => kwespay.getMerchantConfig(c.vendorId));

  return { key, merchant, steps };
}

export function previewQuote(c: Credentials, network: string, asset: string, fiatAmount: number, fiatCurrency: string): Promise<QuoteResult> {
  return makeClient(c).getQuote({ vendorIdentifier: c.vendorId, fiatAmount, fiatCurrency, cryptoCurrency: asset as never, network: network as never });
}

export interface PaymentRequest {
  credentials: Credentials;
  accountSteps: Step[];
  network: string;
  asset: string;
  fiatAmount: number;
  fiatCurrency: string;
  payer: string;
  walletName: string;
  payParams: (payload: TransactionPayload, onStatus: (title: string, detail: string) => void) => PayParams;
  onUpdate: (run: Run) => void;
}

export async function runPayment(req: PaymentRequest): Promise<Run> {
  const kwespay = makeClient(req.credentials);
  const run = newRun(req);
  const sdk = createTracer(run, req.onUpdate);
  sdk.emit();

  try {
    const quote: QuoteParams & { payerWalletAddress: string } = {
      vendorIdentifier: req.credentials.vendorId,
      fiatAmount: req.fiatAmount,
      fiatCurrency: req.fiatCurrency,
      cryptoCurrency: req.asset as never,
      network: req.network as never,
      payerWalletAddress: req.payer,
    };
    const payment = await sdk.call("quote", quote, () => kwespay.quote(quote), (p) => `ref=${p.transactionReference} total=${p.totalBaseUnits}`);
    run.payload = payment;

    sdk.phase("wallet", `Open ${req.walletName} and approve the payment.`);
    const paid = await sdk.call(
      "pay",
      { transactionReference: payment.transactionReference, network: payment.network, totalBaseUnits: payment.totalBaseUnits },
      () => kwespay.pay(req.payParams(payment, onWalletStatus)),
      (r) => `tx=${r.txHash}`,
    );
    run.txHash = paid.txHash;
    run.submitted = true;

    sdk.phase("confirming", "Waiting for KwesPay to confirm the payment…");
    const final = await sdk.call(
      "poll",
      { transactionReference: payment.transactionReference },
      () => kwespay.pollTransactionStatus(payment.transactionReference, { onStatus: onKwesPayStatus }),
      (f) => `status=${f.transactionStatus}`,
    );
    run.final = final;

    if (final.transactionStatus !== "completed") {
      sdk.markFailed("poll", final);
      throw Object.assign(new Error(`Payment ended as ${final.transactionStatus}`), { code: "TRANSACTION_FAILED" });
    }

    sdk.phase("completed", "Payment confirmed by KwesPay.");
  } catch (error) {
    sdk.fail(error);
  }
  return run;

  function onWalletStatus(title: string, detail: string) {
    if (/submit|broadcast|sent/i.test(`${title} ${detail}`)) {
      run.submitted = true;
      run.phase = "submitted";
      run.phaseText = "Payment sent. Waiting for the network to confirm it…";
    } else if (run.phase === "wallet") {
      run.phaseText = `${title}. ${detail}`.replace(/\.\./g, ".");
    }
    sdk.note(`pay · ${title}`, detail);
  }

  function onKwesPayStatus(status: string) {
    run.phaseText = `KwesPay status: ${status}`;
    sdk.note("status", status);
  }
}

function newRun(req: PaymentRequest): Run {
  return {
    id: `r_${Date.now().toString(36)}`,
    network: req.network,
    asset: req.asset,
    fiatAmount: req.fiatAmount,
    fiatCurrency: req.fiatCurrency,
    startedAt: Date.now(),
    phase: "preparing",
    phaseText: "Getting a price from KwesPay…",
    submitted: false,
    steps: [
      ...req.accountSteps,
      step("quote", "Create price quote", "quote()"),
      step("pay", "Send payment from wallet", "pay()"),
      step("poll", "Confirm with KwesPay", "pollTransactionStatus()"),
    ],
    logs: [],
  };
}

async function timed<T>(steps: Step[], s: Step, request: unknown, call: () => Promise<T>): Promise<T> {
  const started = performance.now();
  const result = await call();
  steps.push({ ...s, state: "ok", ms: Math.round(performance.now() - started), request, response: result });
  return result;
}
