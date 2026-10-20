# KwesPay Console

**[Open the console →](https://kwespay.github.io/kwespay-console/)**

Make real **Stellar Testnet** payments with [`@kwespay/client`](https://www.npmjs.com/package/@kwespay/client) from your browser, with nothing to install. Watch every step from the signed quote to on-chain confirmation, then copy the exact code into your app. Sui Testnet and six EVM testnets run through the same flow.

- **See it work before you build.** Go from API key to a confirmed payment in a few minutes.
- **Debug with full visibility.** Every SDK call shows its request, response, timing and error.
- **Keep proof.** Each payment exports JSON matching the SDK's values to KwesPay's records.

Testnet only. Test tokens have no real value.

## Before you start

- **[Freighter](https://www.freighter.app)** browser extension, set to **Testnet** (Settings → Network)
- A **testnet merchant** from the [KwesPay testnet dashboard](https://app.testnet.kwespay.xyz): an **API key**, a **Vendor ID**, and Stellar Testnet enabled with a Stellar receiving wallet

## Your first Stellar payment

1. [Open the console](https://kwespay.github.io/kwespay-console/?network=stellarTestnet) on Stellar Testnet.
2. Click **Connect** and paste your API key and Vendor ID.
3. Click **Connect wallet** and approve Freighter.
4. Open **Test tokens**:
   - **Get test XLM.** Friendbot funds and activates your account.
   - **Enable USDC.** This adds the USDC trustline.
   - **Get 5 test USDC.** This swaps a little XLM on the Stellar test exchange.
5. Pick **USDC** and enter an amount in any currency (for example GH₵50). The console shows what you'll pay, including KwesPay's 1% Stellar fee.
6. Press **Send** and approve in Freighter. The result pane moves through *Quote created → Approved → Broadcast → Confirmed by KwesPay*.
7. Click **View transaction** to open it on stellar.expert, or **Export evidence** to save the record.

## Put it in your app

Press **View code** in the console to get this filled in with your network, token, amount and vendor.

```ts
import { KwesPayClient } from "@kwespay/client";
import { requestAccess, signTransaction } from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";

const kwespay = new KwesPayClient({
  apiKey: "YOUR_API_KEY",
  graphqlEndpoint: "https://api.testnet.kwespay.xyz/graphql",
});

const { address } = await requestAccess();
const freighterWallet = {
  getAddress: async () => ({ address }),
  signTransaction: (xdr: string) => signTransaction(xdr, { networkPassphrase: Networks.TESTNET, address }),
};

const payment = await kwespay.quote({
  vendorIdentifier: "YOUR_VENDOR_ID",
  fiatAmount: 50,
  fiatCurrency: "GHS",
  cryptoCurrency: "USDC",
  network: "stellarTestnet",
  payerWalletAddress: address,
});

const { txHash } = await kwespay.pay({ wallet: freighterWallet, payload: payment });

const { transactionStatus } = await kwespay.pollTransactionStatus(payment.transactionReference);
```

For EVM networks, pass `provider: window.ethereum` instead of `wallet`. Sui takes a Sui wallet adapter in the same position.

## How a payment works

```
quote()                  KwesPay prices it at live FX rates, then signs amount, recipient,
                         token, fee and deadline (Ed25519 on Stellar)
pay()                    Freighter signs and submits the Soroban transaction.
                         The contract checks KwesPay's signature, takes amount + fee, pays the merchant
pollTransactionStatus()  KwesPay records the on-chain payment and returns "completed"
```

KwesPay sets every payment term, and the browser can't change them. Read the fee from the payload as `totalBaseUnits − amountBaseUnits`. It's 1% on Stellar and 0.5% on the EVM testnets.

## Networks

| Network | Tokens | Wallet |
|---|---|---|
| **Stellar Testnet** | XLM, USDC | Freighter |
| Sui Testnet | SUI | Sui wallets (e.g. Slush) |
| NEAR Testnet | NEAR, USDC.e, USDT, USDC | Meteor, Intear or Sender |
| Base Sepolia, Ethereum Sepolia, Arbitrum Sepolia, Polygon Amoy, Lisk Sepolia, Mezo Testnet | Native token plus USDC, USDT, ARB or LSK (varies by network) | MetaMask, Rabby or any EIP-6963 wallet |

The console only offers the tokens your merchant accepts. Amounts can use any ISO 4217 currency. USD, GHS, NGN, KES, ZAR and ZWG are listed first.

## NEAR Testnet

1. [Open the console](https://kwespay.github.io/kwespay-console/?network=nearTestnet) on NEAR Testnet and connect your merchant (NEAR Testnet enabled, with a NEAR receiving account).
2. **Connect wallet** and pick Meteor, Intear or Sender. The console loads NEAR wallet support only when you open this network.
3. **Test tokens**: get test NEAR from the NEAR faucet, then press **Get 100 test USDC.e** or **Get 100 test USDT**. The first mint also registers your account with the token. Circle USDC comes from Circle's faucet.
4. Send. Native NEAR goes through `pay_near`; stablecoins go through `ft_transfer_call` on the token. KwesPay's NEAR fee is 1%.

## Payment statuses

| Status | Meaning |
|---|---|
| `completed` | Paid in full and confirmed on-chain |
| `underpaid` / `overpaid` | Confirmed, but the amount differs from the quote |
| `failed` / `expired` | Not paid. Quotes last 10 minutes and transactions 15 minutes |
| `refunded` | Paid, then refunded |

## Evidence

**Export evidence** downloads one JSON file per payment. It contains the network, asset, fiat amount, tx hash, the signed payload (signature shortened), KwesPay's final record, the structured logs, and a field-by-field check of network, reference, payer, token, tx hash and final status. **Developer details → Logs** copies the same logs as JSONL.

## Troubleshooting

| You see | Fix |
|---|---|
| Payment cancelled (`WALLET_REJECTED`) | The request was declined in the wallet. Press Send again. |
| Freighter is on a different network | Freighter → Settings → Network → Testnet. |
| Your Stellar wallet isn't activated yet | **Test tokens → Get test XLM**. |
| USDC isn't enabled in this Stellar wallet | **Test tokens → Enable USDC**. |
| Not enough USDC or XLM | **Test tokens**. Keep a few XLM for network fees. |
| API key not accepted / Merchant not found | Re-check the key and Vendor ID under **Change**. The key must cover this network. |
| Network not enabled / Token isn't available | Enable it for your merchant in the dashboard. |
| Price expired | The quote is older than 10 minutes. Press Send again. |

**Developer details → Error** shows the raw SDK error for any step.

## Privacy

Your API key is kept only in this browser tab (`sessionStorage`) and is sent only to the KwesPay API. Your wallet signs every transaction. The console never asks for a recovery phrase or private key, and it refuses mainnet endpoints.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000, uses a local testnet backend on :8002
pnpm build        # static export to out/
pnpm typecheck
```

Every push to `main` deploys to GitHub Pages (`.github/workflows/pages.yml`). Set `NEXT_PUBLIC_KWESPAY_ENDPOINT` to override the API endpoint.


