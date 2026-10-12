"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getWallets, type Wallet, type WalletAccount } from "@mysten/wallet-standard";
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { readLocal, writeLocal } from "../storage";
import { isUserRejection } from "./evm";

const CHAIN = "sui:testnet";

type Features = Record<string, any>;

function isSuiWallet(w: Wallet): boolean {
  const f = w.features as Features;
  return Boolean(f["standard:connect"] && (f["sui:signAndExecuteTransaction"] || f["sui:signAndExecuteTransactionBlock"]));
}

let client: SuiJsonRpcClient | undefined;
export function suiClient(): SuiJsonRpcClient {
  if (!client) client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl("testnet"), network: "testnet" });
  return client;
}

export interface SuiWalletState {
  options: Wallet[];
  status: "idle" | "connecting" | "connected";
  wallet?: Wallet;
  account?: WalletAccount;
  error?: string;
}

export function useSuiWallet() {
  const [state, setState] = useState<SuiWalletState>({ options: [], status: "idle" });
  const ref = useRef<{ wallet?: Wallet; account?: WalletAccount }>({});

  useEffect(() => {
    const api = getWallets();
    const refresh = () => setState((s) => ({ ...s, options: api.get().filter(isSuiWallet) }));
    refresh();
    const offRegister = api.on("register", refresh);
    const offUnregister = api.on("unregister", refresh);
    return () => {
      offRegister();
      offUnregister();
    };
  }, []);

  const attach = useCallback(async (wallet: Wallet, silent: boolean) => {
    setState((s) => ({ ...s, status: "connecting", error: undefined }));
    try {
      const f = wallet.features as Features;
      const res = await f["standard:connect"].connect(silent ? { silent: true } : undefined);
      const accounts: readonly WalletAccount[] = res?.accounts?.length ? res.accounts : wallet.accounts;
      const account = accounts.find((a) => a.chains.includes(CHAIN)) ?? accounts[0];
      if (!account) {
        setState((s) => ({ ...s, status: "idle" }));
        return false;
      }
      ref.current = { wallet, account };
      writeLocal("kp-sui-wallet", wallet.name);
      setState((s) => ({ ...s, status: "connected", wallet, account, error: undefined }));
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "idle",
        error: silent ? undefined : isUserRejection(e) ? `You declined the connection request in ${wallet.name}.` : `${wallet.name} couldn't connect.`,
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const saved = readLocal("kp-sui-wallet");
    if (!saved || state.status !== "idle" || ref.current.wallet) return;
    const w = state.options.find((o) => o.name === saved);
    if (w) void attach(w, true);
  }, [state.options, state.status, attach]);

  useEffect(() => {
    const w = state.wallet;
    const events = (w?.features as Features | undefined)?.["standard:events"];
    if (!w || !events) return;
    return events.on("change", ({ accounts }: { accounts?: readonly WalletAccount[] }) => {
      if (!accounts) return;
      if (accounts.length === 0) {
        ref.current = {};
        writeLocal("kp-sui-wallet", "");
        setState((s) => ({ ...s, status: "idle", wallet: undefined, account: undefined }));
      } else {
        const account = accounts.find((a) => a.chains.includes(CHAIN)) ?? accounts[0];
        ref.current.account = account;
        setState((s) => ({ ...s, account }));
      }
    });
  }, [state.wallet]);

  const connect = useCallback((w: Wallet) => attach(w, false), [attach]);

  const disconnect = useCallback(async () => {
    const w = ref.current.wallet;
    ref.current = {};
    writeLocal("kp-sui-wallet", "");
    try {
      await (w?.features as Features | undefined)?.["standard:disconnect"]?.disconnect();
    } catch {}
    setState((s) => ({ ...s, status: "idle", wallet: undefined, account: undefined, error: undefined }));
  }, []);

  const adapter = useCallback(() => {
    const { wallet, account } = ref.current;
    if (!wallet || !account) return undefined;
    const f = wallet.features as Features;
    return {
      accounts: [{ address: account.address }],
      async connect() {
        return { accounts: [{ address: account.address }] };
      },
      async signAndExecuteTransactionBlock({ transactionBlock, options }: { transactionBlock: unknown; options?: Record<string, unknown> }) {
        let digest: string;
        if (f["sui:signAndExecuteTransaction"]) {
          const r = await f["sui:signAndExecuteTransaction"].signAndExecuteTransaction({ transaction: transactionBlock, account, chain: CHAIN });
          digest = r.digest;
        } else {
          const r = await f["sui:signAndExecuteTransactionBlock"].signAndExecuteTransactionBlock({ transactionBlock, account, chain: CHAIN, options });
          digest = r.digest;
        }
        const tx = await suiClient().waitForTransaction({ digest, options: { showEffects: true } });
        return { digest, effects: tx.effects ?? undefined };
      },
    };
  }, []);

  return { ...state, connect, disconnect, adapter };
}

export async function suiBalance(owner: string): Promise<number> {
  const b = await suiClient().getBalance({ owner, coinType: "0x2::sui::SUI" });
  return Number(b.totalBalance) / 1e9;
}
