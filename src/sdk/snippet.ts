import type { Ecosystem } from "@/src/networks";

const SDK_DEFAULT_ENDPOINT = "https://api.kwespay.xyz/graphql";

const WALLET_ARG: Record<Ecosystem, string> = {
  evm: "provider: window.ethereum",
  sui: "wallet: suiWallet",
  stellar: "wallet: freighterWallet",
  near: "wallet: nearWallet",
};

export interface SnippetInput {
  ecosystem: Ecosystem;
  network: string;
  asset: string;
  amount: number;
  currency: string;
  vendorId?: string;
  apiKey?: string;
  endpoint: string;
}

function maskKey(key?: string): string {
  if (!key) return "YOUR_API_KEY";
  return key.length > 12 ? `${key.slice(0, 6)}…${key.slice(-4)}` : key;
}

export function buildSnippet(i: SnippetInput): string {
  const clientConfig = i.endpoint.replace(/\/$/, "") === SDK_DEFAULT_ENDPOINT ? `{ apiKey: "${maskKey(i.apiKey)}" }` : `{\n  apiKey: "${maskKey(i.apiKey)}",\n  graphqlEndpoint: "${i.endpoint}",\n}`;
  return [
    `import { KwesPayClient } from "@kwespay/client";`,
    ``,
    `const kwespay = new KwesPayClient(${clientConfig});`,
    ``,
    `const payment = await kwespay.quote({`,
    `  vendorIdentifier: "${i.vendorId || "YOUR_VENDOR_ID"}",`,
    `  fiatAmount: ${Number.isFinite(i.amount) && i.amount > 0 ? i.amount : 10},`,
    `  fiatCurrency: "${i.currency}",`,
    `  cryptoCurrency: "${i.asset}",`,
    `  network: "${i.network}",`,
    `  payerWalletAddress: customerAddress,`,
    `});`,
    ``,
    `const { txHash } = await kwespay.pay({ ${WALLET_ARG[i.ecosystem]}, payload: payment });`,
    ``,
    `const { transactionStatus } = await kwespay.pollTransactionStatus(payment.transactionReference);`,
  ].join("\n");
}

export type Token = { text: string; kind: "keyword" | "string" | "number" | "key" | "fn" | "punct" | "plain" };

const PATTERN = /("(?:[^"\\]|\\.)*")|\b(import|from|const|await|new)\b|\b(\d+(?:\.\d+)?)\b|([A-Za-z_$][\w$]*)(?=\s*:)|([A-Za-z_$][\w$]*)(?=\()|([{}()[\],;.:=])/g;

export function highlight(line: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of line.matchAll(PATTERN)) {
    if (m.index! > last) out.push({ text: line.slice(last, m.index), kind: "plain" });
    const kind: Token["kind"] = m[1] ? "string" : m[2] ? "keyword" : m[3] ? "number" : m[4] ? "key" : m[5] ? "fn" : "punct";
    out.push({ text: m[0], kind });
    last = m.index! + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: "plain" });
  return out;
}
