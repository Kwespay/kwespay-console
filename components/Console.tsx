"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MerchantConfig, PayParams, TransactionPayload } from "@kwespay/client";
import { assetsFor, networkByKey, TESTNET_NETWORKS, type ConsoleNetwork } from "@/src/networks";
import { connectAccount, makeClient, previewQuote, runPayment, type Credentials, type Run, type Step } from "@/src/sdk/run";
import { errorCode, friendlyError } from "@/src/sdk/errors";
import { buildSnippet } from "@/src/sdk/snippet";
import { readSession, writeSession } from "@/src/storage";
import { mintKwespayToken, requestTestSui } from "@/src/tokens";
import { chainName, evmBalances, useEvmWallet } from "@/src/wallets/evm";
import { suiBalance, useSuiWallet } from "@/src/wallets/sui";
import { buyTestUsdc, enableUsdc, friendbot, stellarAccount, useStellarWallet, type StellarAccountInfo } from "@/src/wallets/stellar";
import { mintNearTestToken, nearBalances, useNearWallet } from "@/src/wallets/near";
import { AccountModal } from "./AccountModal";
import { Composer, type AssetChoice, type Issue, type Preview, type Readiness } from "./Composer";
import { DeveloperDetails, type DetailsTab, type EvidenceRow } from "./DeveloperDetails";
import { Header } from "./Header";
import { NetworkPicker } from "./NetworkPicker";
import { ResultPanel } from "./ResultPanel";
import { TestTokensSheet, type TokenItem } from "./TestTokensSheet";
import { Button } from "./ui";
import { WalletSheet } from "./WalletSheet";

const HOSTED_ENDPOINT = process.env.NEXT_PUBLIC_KWESPAY_ENDPOINT || "https://api.testnet.kwespay.xyz/graphql";
const LOCAL_ENDPOINT = "http://localhost:8002/graphql";
const MAINNET_HOSTS = ["api.kwespay.xyz", "localhost:8001", "127.0.0.1:8001"];
const GAS_MIN: Record<string, number> = { evm: 0.0003, sui: 0.05, stellar: 2, near: 0.05 };

interface AccountState {
  connected: boolean;
  connecting: boolean;
  vendorName?: string;
  error?: string;
  credentials?: Credentials;
  merchant?: MerchantConfig;
  steps: Step[];
}

function accountError(e: unknown, endpoint: string): string {
  const code = errorCode(e);
  if (code === "INVALID_KEY") return "That API key wasn't accepted. Check that it's active and covers this vendor.";
  if (code === "MERCHANT_NOT_FOUND") return "We couldn't find that vendor. Check the vendor ID in your dashboard.";
  if (code === "NETWORK_ERROR" || /fetch|network/i.test(String((e as Error)?.message))) return `We couldn't reach KwesPay at ${endpoint}.`;
  return String((e as Error)?.message ?? "Couldn't connect.");
}

function decimalsFor(network: ConsoleNetwork, symbol: string): number {
  if (symbol === network.native.symbol) return network.native.decimals;
  return network.tokens.find((t) => t.symbol === symbol)?.decimals ?? 18;
}

function sameHash(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  const n = (x: string) => x.toLowerCase().replace(/^0x/, "");
  return n(a) === n(b);
}

function download(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Console() {
  const [networkKey, setNetworkKey] = useState("baseSepolia");
  const [asset, setAsset] = useState("USDC");
  const [amount, setAmount] = useState("10");
  const [currency, setCurrency] = useState("USD");
  const [account, setAccount] = useState<AccountState>({ connected: false, connecting: false, steps: [] });
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [stellarInfo, setStellarInfo] = useState<StellarAccountInfo | undefined>(undefined);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [preview, setPreview] = useState<Preview>({ state: "idle" });
  const [run, setRun] = useState<Run | undefined>(undefined);
  const [runs, setRuns] = useState<Run[]>([]);
  const [walletOpen, setWalletOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tokensOpen, setTokensOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("code");
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  const [defaultEndpoint, setDefaultEndpoint] = useState(HOSTED_ENDPOINT);
  const evm = useEvmWallet();
  const sui = useSuiWallet();
  const stellar = useStellarWallet();
  const near = useNearWallet();
  const network = networkByKey(networkKey);
  const eco = network.ecosystem;
  const nearDiscover = near.discover;

  useEffect(() => {
    if (eco === "near") void nearDiscover();
  }, [eco, nearDiscover]);
  const running = Boolean(run && run.phase !== "completed" && run.phase !== "failed");

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_KWESPAY_ENDPOINT && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) setDefaultEndpoint(LOCAL_ENDPOINT);
    const p = new URLSearchParams(window.location.search).get("network");
    if (p && TESTNET_NETWORKS.some((n) => n.key === p)) setNetworkKey(p);
    setRuns(readSession<Run[]>("kp-runs", []));
    const saved = readSession<Credentials | null>("kp-creds", null);
    if (saved?.apiKey && saved.vendorId) void doConnectAccount(saved);
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("network", networkKey);
    window.history.replaceState(null, "", url.toString());
  }, [networkKey]);

  const doConnectAccount = useCallback(async (c: Credentials): Promise<boolean> => {
    if (MAINNET_HOSTS.some((h) => c.endpoint.includes(h))) {
      setAccount({ connected: false, connecting: false, error: `That's the mainnet API. The console only runs on testnet: use ${HOSTED_ENDPOINT}`, credentials: c, steps: [] });
      return false;
    }
    setAccount((a) => ({ ...a, connecting: true, error: undefined, credentials: c }));
    try {
      const r = await connectAccount(c);
      writeSession("kp-creds", c);
      setAccount({ connected: true, connecting: false, vendorName: r.merchant.businessName || r.key.vendorInfo?.businessName, credentials: c, merchant: r.merchant, steps: r.steps });
      return true;
    } catch (e) {
      setAccount({ connected: false, connecting: false, error: accountError(e, c.endpoint), credentials: c, steps: [] });
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    writeSession("kp-creds", null);
    setAccountOpen(false);
    setAccount({ connected: false, connecting: false, steps: [] });
    setPreview({ state: "idle" });
  }, []);

  const wallet = useMemo(() => {
    if (eco === "evm") return { connected: evm.status === "connected", connecting: evm.status === "connecting", name: evm.wallet?.name ?? "your wallet", icon: evm.wallet?.icon, address: evm.address, error: evm.error };
    if (eco === "sui") return { connected: sui.status === "connected", connecting: sui.status === "connecting", name: sui.wallet?.name ?? "your Sui wallet", icon: sui.wallet?.icon as string | undefined, address: sui.account?.address, error: sui.error };
    if (eco === "near") return { connected: near.status === "connected", connecting: near.status === "connecting", name: near.walletName ?? "your NEAR wallet", icon: near.walletIcon, address: near.accountId, error: near.error };
    return { connected: stellar.status === "connected", connecting: stellar.status === "connecting", name: "Freighter", icon: undefined, address: stellar.address, error: stellar.error };
  }, [eco, evm, sui, stellar, near]);

  const switchNetwork = useCallback(async () => {
    setActionError(undefined);
    const err = await evm.switchTo(network);
    if (err) setActionError(err);
  }, [evm, network]);

  const walletProblem: Issue | undefined = useMemo(() => {
    if (!wallet.connected) return undefined;
    if (eco === "evm" && evm.chainId !== network.chainId)
      return { title: `Your wallet is on ${chainName(evm.chainId)}`, message: `Switch to ${network.name} to continue.`, action: { label: "Switch network", onClick: () => void switchNetwork(), primary: true } };
    if (eco === "stellar" && !stellar.onTestnet) return { title: "Freighter is on a different network", message: "Open Freighter, go to Settings → Network, and choose Testnet." };
    if (eco === "sui" && sui.account && !sui.account.chains.includes("sui:testnet")) return { title: "Your Sui wallet isn't on Testnet", message: "Switch your Sui wallet to Testnet in its settings." };
    return undefined;
  }, [wallet.connected, eco, evm.chainId, network, stellar.onTestnet, sui.account, switchNetwork]);

  useEffect(() => {
    const address = wallet.address;
    if (!wallet.connected || !address) {
      setBalances({});
      setStellarInfo(undefined);
      return;
    }
    let alive = true;
    setBalancesLoading(true);
    (async () => {
      try {
        if (eco === "evm") {
          const list = await evmBalances(network, address);
          if (alive) setBalances(Object.fromEntries(list.map((b) => [b.symbol, b.amount])));
        } else if (eco === "sui") {
          const s = await suiBalance(address);
          if (alive) setBalances({ SUI: s });
        } else if (eco === "near") {
          const b = await nearBalances(network, address);
          if (alive) setBalances(b);
        } else {
          const info = await stellarAccount(address);
          if (alive) {
            setStellarInfo(info);
            setBalances({ XLM: info.xlm, USDC: info.usdc });
          }
        }
      } catch {
        if (alive) setBalances({});
      } finally {
        if (alive) setBalancesLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [wallet.connected, wallet.address, eco, network, refreshTick]);

  const merchantTokens = useMemo(() => {
    const entry = account.merchant?.networkTokenMap.find((m) => m.network === network.key);
    return entry ? entry.tokens.map((t) => String(t).toUpperCase()) : undefined;
  }, [account.merchant, network.key]);

  const networkEnabled = !account.merchant || account.merchant.enabledNetworks.includes(network.key as never);

  const assetChoices: AssetChoice[] = useMemo(
    () =>
      assetsFor(network).map((a) => {
        const accepted = !merchantTokens || merchantTokens.includes(a.symbol.toUpperCase());
        return { symbol: a.symbol, name: a.native ? network.native.name : a.token!.name, available: accepted, reason: accepted ? undefined : "Not accepted", balance: wallet.connected ? balances[a.symbol] : undefined };
      }),
    [network, merchantTokens, balances, wallet.connected],
  );

  useEffect(() => {
    const current = assetChoices.find((a) => a.symbol === asset);
    if (!current || !current.available) {
      const next = assetChoices.find((a) => a.available && a.symbol !== network.native.symbol) ?? assetChoices.find((a) => a.available);
      if (next && next.symbol !== asset) setAsset(next.symbol);
    }
  }, [assetChoices, asset, network.native.symbol]);

  const fiat = Number(amount);
  const assetAvailable = assetChoices.find((a) => a.symbol === asset)?.available ?? false;

  useEffect(() => {
    if (!account.connected || !account.credentials || !networkEnabled || !assetAvailable || !(fiat > 0) || running) {
      setPreview({ state: "idle" });
      return;
    }
    setPreview({ state: "loading" });
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const q = await previewQuote(account.credentials!, network.key, asset, fiat, currency);
        const dec = decimalsFor(network, asset);
        const amt = Number(q.amountBaseUnits) / 10 ** dec;
        const total = Number(q.totalBaseUnits) / 10 ** dec;
        if (alive) setPreview({ state: "ok", amount: amt, total, fee: total - amt });
      } catch (e) {
        if (!alive) return;
        const f = friendlyError(e, { walletName: wallet.name, networkName: network.name, asset, submitted: false });
        setPreview({ state: "error", message: `${f.title}. ${f.message}` });
      }
    }, 650);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [account.connected, account.credentials, networkEnabled, assetAvailable, fiat, currency, asset, network, running, wallet.name]);

  const openTokens = useCallback(() => setTokensOpen(true), []);

  const issues: Issue[] = useMemo(() => {
    if (!account.connected || !wallet.connected || walletProblem || !networkEnabled || balancesLoading) return [];
    const list: Issue[] = [];
    const native = network.native.symbol;
    if (eco === "stellar" && stellarInfo && !stellarInfo.exists)
      return [{ title: "Your Stellar wallet isn't activated yet", message: "New Stellar wallets need a little test XLM before they can be used.", action: { label: "Get test XLM", onClick: openTokens } }];
    if ((balances[native] ?? 0) < (GAS_MIN[eco] ?? 0))
      list.push({ title: `You need test ${native} for network fees`, message: `Network fees are paid in ${native}. Test ${native} is free and has no real value.`, action: { label: `Get test ${native}`, onClick: openTokens } });
    if (eco === "stellar" && asset === "USDC" && stellarInfo && !stellarInfo.usdcEnabled)
      list.push({
        title: "USDC isn't enabled in this Stellar wallet",
        message: "USDC needs to be enabled in your Stellar wallet before you can send or receive it. (Technical detail: creates a Stellar trustline.)",
        action: {
          label: "Enable USDC",
          onClick: async () => {
            setActionError(undefined);
            try {
              await enableUsdc(stellar.address!, stellar.signXdr);
              setRefreshTick((x) => x + 1);
            } catch (e) {
              setActionError(/reject|denied|declin/i.test(String((e as Error)?.message)) ? "You cancelled the request in Freighter." : `Couldn't enable USDC: ${String((e as Error)?.message)}`);
            }
          },
        },
      });
    if (preview.state === "ok" && preview.total !== undefined) {
      const have = balances[asset] ?? 0;
      const need = asset === native ? preview.total + (GAS_MIN[eco] ?? 0) : preview.total;
      if (have < need && !(eco === "stellar" && asset === "USDC" && stellarInfo && !stellarInfo.usdcEnabled))
        list.push({ title: `You don't have enough test ${asset}`, message: `This payment needs about ${need.toFixed(asset === native ? 4 : 2)} ${asset}, but your wallet has ${have.toFixed(4).replace(/\.?0+$/, "")}.`, action: { label: `Get test ${asset}`, onClick: openTokens } });
    }
    return list;
  }, [account.connected, wallet.connected, walletProblem, networkEnabled, balancesLoading, network, eco, stellarInfo, balances, asset, preview, openTokens, stellar.address, stellar.signXdr]);

  const readiness: Readiness = useMemo(() => {
    if (!account.connected) return { tone: "hint", title: "Start by connecting your KwesPay account.", step: 1 };
    if (!networkEnabled) return { tone: "warn", title: `${network.name} isn't enabled for this merchant`, message: "Choose another network, or enable it in your KwesPay dashboard." };
    if (!wallet.connected) return { tone: "hint", title: eco === "stellar" ? "Now connect a Stellar wallet." : eco === "sui" ? "Now connect a Sui wallet." : eco === "near" ? "Now connect a NEAR wallet." : "Now connect a wallet.", step: 2 };
    if (walletProblem) return { tone: "warn", ...walletProblem };
    if (!assetAvailable) return { tone: "warn", title: "No accepted token on this network", message: `This merchant doesn't accept any token the console can use on ${network.name}.` };
    if (issues.length) return { tone: "warn", ...issues[0], more: issues.slice(1) };
    if (!(fiat > 0)) return { tone: "hint", title: "Enter an amount and send a test payment.", step: 3 };
    if (preview.state === "error") return { tone: "warn", title: "Couldn't preview the price", message: preview.message, allowSend: true };
    if (balancesLoading || preview.state === "loading") return { tone: "hint", title: "Getting the latest price…" };
    return { tone: "ready", title: "Ready to send", message: `${wallet.name} will ask you to approve` };
  }, [account.connected, networkEnabled, network.name, wallet.connected, wallet.name, eco, walletProblem, assetAvailable, issues, fiat, preview, balancesLoading]);

  const saveRuns = useCallback((r: Run) => {
    setRuns((prev) => {
      const next = [r, ...prev.filter((x) => x.id !== r.id)].slice(0, 12);
      writeSession(
        "kp-runs",
        next.map((x) => ({ ...x, error: x.error ? { code: errorCode(x.error), message: String((x.error as Error)?.message ?? x.error) } : undefined })),
      );
      return next;
    });
  }, []);

  const pay = useCallback(async () => {
    if (!account.credentials || !wallet.address) return;
    setActionError(undefined);
    const ecoNow = eco;
    const adapter = ecoNow === "sui" ? sui.adapter() : ecoNow === "stellar" ? stellar.adapter() : ecoNow === "near" ? near.adapter() : undefined;
    const payParams = (payload: TransactionPayload, onStatus: (t: string, d: string) => void): PayParams => {
      if (ecoNow === "evm") return { provider: evm.wallet!.provider as never, payload, onStatus };
      return { wallet: adapter as never, payload, onStatus };
    };
    const final = await runPayment({
      credentials: account.credentials,
      accountSteps: account.steps,
      network: network.key,
      asset,
      fiatAmount: fiat,
      fiatCurrency: currency,
      payer: wallet.address,
      walletName: wallet.name,
      payParams,
      onUpdate: (r) => {
        setRun(r);
        saveRuns(r);
      },
    });
    setRun(final);
    saveRuns(final);
    setRefreshTick((x) => x + 1);
  }, [account.credentials, account.steps, wallet.address, wallet.name, eco, sui, stellar, near, evm.wallet, network.key, asset, fiat, currency, saveRuns]);

  const runNetwork = run ? networkByKey(run.network) : network;
  const runError = run?.phase === "failed" && run.error
    ? friendlyError(run.error, {
        walletName: wallet.name,
        networkName: runNetwork.name,
        asset: run.asset,
        submitted: run.submitted,
        needed: preview.total !== undefined ? preview.total.toFixed(4) : undefined,
        have: balances[run.asset] !== undefined ? String(balances[run.asset]) : undefined,
      })
    : undefined;

  const evidence: EvidenceRow[] = useMemo(() => {
    if (!run?.payload || !run.final) return [];
    const p = run.payload;
    const f = run.final;
    const row = (field: string, sdk: string, backend: string | null | undefined, eq: boolean): EvidenceRow => ({ field, sdk, backend: backend ?? "—", result: backend ? (eq ? "match" : "mismatch") : "pending" });
    return [
      row("Network", run.network, f.blockchainNetwork, run.network === f.blockchainNetwork),
      row("Transaction reference", p.transactionReference, f.transactionReference, p.transactionReference === f.transactionReference),
      row("Payer", (run.steps.find((s) => s.id === "quote")?.request as { payerWalletAddress?: string } | undefined)?.payerWalletAddress ?? "—", f.payerWalletAddress, ((run.steps.find((s) => s.id === "quote")?.request as { payerWalletAddress?: string } | undefined)?.payerWalletAddress ?? "").toLowerCase() === (f.payerWalletAddress ?? "").toLowerCase()),
      row("Token", run.asset, f.cryptoCurrency, run.asset.toUpperCase() === (f.cryptoCurrency ?? "").toUpperCase()),
      row("Transaction hash", run.txHash ?? "—", f.blockchainHash, sameHash(run.txHash, f.blockchainHash)),
      row("Final status", "completed", f.transactionStatus, f.transactionStatus === "completed"),
      { field: "Merchant amount", sdk: p.amountBaseUnits, backend: "not exposed by getTransactionStatus", result: "na" },
      { field: "Total paid", sdk: p.totalBaseUnits, backend: "not exposed by getTransactionStatus", result: "na" },
      { field: "Payment ID", sdk: p.paymentIdBytes32, backend: "not exposed by getTransactionStatus", result: "na" },
    ];
  }, [run]);

  const backendMatched = evidence.length > 0 && evidence.filter((e) => e.result !== "na").every((e) => e.result === "match");

  const exportEvidence = useCallback(() => {
    if (!run) return;
    download(`kwespay-evidence-${run.network}-${run.asset}-${run.payload?.transactionReference ?? run.id}.json`, {
      exportedAt: new Date().toISOString(),
      network: run.network,
      asset: run.asset,
      fiat: { amount: run.fiatAmount, currency: run.fiatCurrency },
      txHash: run.txHash,
      payload: run.payload ? { ...run.payload, backendSignature: `${run.payload.backendSignature.slice(0, 8)}…${run.payload.backendSignature.slice(-6)}` } : undefined,
      backend: run.final,
      evidence,
      logs: run.logs,
    });
  }, [run, evidence]);

  const chainData = useMemo(
    () => ({
      network: network.key,
      chainId: network.chainId ?? null,
      rpcUrl: network.rpcUrl,
      walletChainId: eco === "evm" ? evm.chainId ?? null : null,
      walletAddress: wallet.address ?? null,
      contractAddress: run?.payload?.contractAddress ?? null,
      tokenAddress: run?.payload?.tokenAddress ?? null,
      amountBaseUnits: run?.payload?.amountBaseUnits ?? null,
      totalBaseUnits: run?.payload?.totalBaseUnits ?? null,
      deadline: run?.payload?.deadline ?? null,
      paymentIdBytes32: run?.payload?.paymentIdBytes32 ?? null,
      txHash: run?.txHash ?? null,
      endpoint: account.credentials?.endpoint ?? defaultEndpoint,
    }),
    [network, eco, evm.chainId, wallet.address, run, account.credentials, defaultEndpoint],
  );

  const tokenItems: TokenItem[] = useMemo(() => {
    const address = wallet.address;
    const needWallet = !wallet.connected || !address;
    const native = network.native.symbol;
    const items: TokenItem[] = [];
    const g = network.gasFaucet;
    const gasItem: TokenItem = { id: "gas", title: `Get test ${native}`, why: `You need test ${native} to pay network fees.`, balance: balances[native], symbol: native, source: "" };
    if (needWallet) gasItem.unavailable = "Connect your wallet first.";
    else if (!g) gasItem.unavailable = `Ask the KwesPay team for ${network.name} test ${native}.`;
    else if (g.kind === "link") {
      gasItem.external = { url: g.url, label: `Open ${native} faucet`, note: "We'll open the faucet page and copy your wallet address for you.", copy: address };
      gasItem.source = "External faucet";
    } else if (g.kind === "sui") {
      gasItem.action = { label: "Get test SUI", run: () => requestTestSui(address!) };
      gasItem.source = "Sui testnet faucet";
    } else {
      gasItem.action = { label: "Get test XLM", run: () => friendbot(address!) };
      gasItem.source = "Stellar Friendbot";
    }
    items.push(gasItem);

    for (const t of network.tokens) {
      const item: TokenItem = { id: t.symbol, title: `Get test ${t.symbol}`, why: `Test ${t.symbol} has no real-world value. Use it to pay merchants on ${network.name}.`, balance: balances[t.symbol], symbol: t.symbol, source: "" };
      if (needWallet) item.unavailable = "Connect your wallet first.";
      else if (t.source.kind === "kwespay") {
        item.source = "KwesPay test token";
        item.action = {
          label: `Get 1,000 test ${t.symbol}`,
          run: async () => {
            if (evm.chainId !== network.chainId) {
              const err = await evm.switchTo(network);
              if (err) throw new Error(err);
            }
            return mintKwespayToken(evm.wallet!.provider, network, t, address!, 1000);
          },
        };
      } else if (t.source.kind === "near-mint") {
        const mintAmount = t.source.amount;
        item.source = "NEAR test token";
        item.why = `Mints ${mintAmount} test ${t.symbol} to your NEAR account. The first mint also registers your account with the token (0.00125 NEAR).`;
        item.action = { label: `Get ${mintAmount} test ${t.symbol}`, run: () => mintNearTestToken(network, t, address!, mintAmount, near.send) };
      } else if (t.source.kind === "circle") {
        item.source = "Circle faucet";
        item.external = { url: "https://faucet.circle.com", label: "Open Circle's test token page", note: `We'll open Circle's page and copy your wallet address. Choose ${network.name} there.`, copy: address };
      } else if (t.source.kind === "stellar-swap") {
        item.source = "Stellar test exchange";
        if (stellarInfo && !stellarInfo.usdcEnabled) {
          item.why = "USDC needs to be enabled in your Stellar wallet first. (Technical detail: creates a Stellar trustline.)";
          item.action = { label: "Enable USDC", run: () => enableUsdc(address!, stellar.signXdr) };
        } else {
          item.why = "Swaps about 6 test XLM for 5 test USDC on the Stellar test exchange.";
          item.action = { label: "Get 5 test USDC", run: () => buyTestUsdc(address!, "5", stellar.signXdr) };
        }
      } else item.unavailable = "No free source for this token yet.";
      items.push(item);
    }
    return items;
  }, [wallet.connected, wallet.address, network, balances, evm, stellarInfo, stellar.signXdr, near.send]);

  const onResultAction = useCallback(
    (kind: string) => {
      if (kind === "retry") void pay();
      else if (kind === "switch-network") void switchNetwork();
      else if (kind === "get-tokens" || kind === "get-gas") setTokensOpen(true);
      else if (kind === "connect-wallet") setWalletOpen(true);
      else if (kind === "edit-connection") setAccountOpen(true);
      else if (kind === "enable-usdc") setTokensOpen(true);
    },
    [pay, switchNetwork],
  );

  const steps = run?.steps ?? account.steps;
  const detailsRef = useRef<HTMLDivElement>(null);

  const code = useMemo(
    () => buildSnippet({ ecosystem: eco, network: network.key, asset, amount: fiat, currency, vendorId: account.credentials?.vendorId, apiKey: account.connected ? account.credentials?.apiKey : undefined, endpoint: account.credentials?.endpoint ?? defaultEndpoint }),
    [eco, network.key, asset, fiat, currency, account.credentials, account.connected, defaultEndpoint],
  );

  const showCode = useCallback(() => {
    setDetailsOpen(true);
    setDetailsTab("code");
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, []);

  const openDetails = useCallback(() => {
    setDetailsOpen(true);
    setDetailsTab(run?.phase === "failed" ? "error" : "evidence");
    setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }, [run?.phase]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header endpoint={account.credentials?.endpoint ?? defaultEndpoint} />

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pt-5 pb-10 sm:px-6">
        <div className="mb-4 flex items-center gap-3">
          <NetworkPicker selected={networkKey} enabled={account.merchant?.enabledNetworks as string[] | undefined} locked={running} onSelect={setNetworkKey} />
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => setTokensOpen(true)}>
              Test tokens
            </Button>
          </div>
        </div>

        <section className="overflow-clip rounded-[var(--radius-lg)] border border-border bg-surface shadow-workspace">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
            <Composer
              network={network}
              account={account}
              onOpenAccount={() => setAccountOpen(true)}
              onShowCode={showCode}
              wallet={wallet}
              onOpenWallet={() => setWalletOpen(true)}
              onDisconnectWallet={() => (eco === "evm" ? void evm.disconnect() : eco === "sui" ? void sui.disconnect() : eco === "near" ? void near.disconnect() : stellar.disconnect())}
              assets={assetChoices}
              asset={asset}
              onAsset={setAsset}
              amount={amount}
              onAmount={setAmount}
              currency={currency}
              onCurrency={setCurrency}
              preview={preview}
              readiness={readiness}
              running={running}
              onPay={() => void pay()}
              error={wallet.connected ? actionError : undefined}
            />
            <div className="border-t border-border bg-surface-2 lg:border-t-0 lg:border-l">
              <ResultPanel
                run={run}
                runs={runs}
                network={runNetwork}
                decimals={run ? decimalsFor(runNetwork, run.asset) : 18}
                error={runError}
                backendMatched={backendMatched}
                onAction={onResultAction}
                onExport={exportEvidence}
                onDetails={openDetails}
                onSelectRun={(r) => {
                  setRun(r);
                  setNetworkKey(r.network);
                }}
              />
            </div>
          </div>

          <div ref={detailsRef} className="scroll-mt-20">
            <DeveloperDetails open={detailsOpen} onToggle={() => setDetailsOpen((o) => !o)} tab={detailsTab} onTab={setDetailsTab} steps={steps} run={run} evidence={evidence} chain={chainData} code={code} onDownloadEvidence={exportEvidence} />
          </div>
        </section>
      </main>

      <AccountModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        connected={account.connected}
        connecting={account.connecting}
        vendorName={account.vendorName}
        error={account.error}
        credentials={account.credentials}
        defaultEndpoint={defaultEndpoint}
        onConnect={async (c) => {
          if (await doConnectAccount(c)) setAccountOpen(false);
        }}
        onSignOut={signOut}
      />

      <WalletSheet
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        ecosystem={eco}
        networkName={network.name}
        evmOptions={evm.options}
        suiOptions={sui.options}
        freighterInstalled={stellar.installed}
        nearOptions={near.options}
        nearLoading={near.loading}
        onNear={async (o) => {
          setWalletOpen(false);
          const contractId = account.credentials
            ? await makeClient(account.credentials).getNetwork(network.key).then((n) => n.contractAddress ?? undefined, () => undefined)
            : undefined;
          await near.connect(o, contractId);
        }}
        onEvm={async (o) => {
          setWalletOpen(false);
          const ok = await evm.connect(o);
          if (ok && network.chainId) setRefreshTick((x) => x + 1);
        }}
        onSui={async (w) => {
          setWalletOpen(false);
          await sui.connect(w);
        }}
        onFreighter={async () => {
          setWalletOpen(false);
          await stellar.connect();
        }}
      />

      <TestTokensSheet open={tokensOpen} onClose={() => setTokensOpen(false)} networkName={network.name} items={tokenItems} explorerTx={network.explorerTx} onDone={() => setTimeout(() => setRefreshTick((x) => x + 1), 2500)} />
    </div>
  );
}
