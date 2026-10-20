"use client";

import { useCallback, useRef, useState } from "react";
import type { ConsoleNetwork, ConsoleToken } from "../networks";

const SELECTOR_VERSION = "10.1.4";
const STORAGE_DEPOSIT = "1250000000000000000000";
const MINT_GAS = "30000000000000";
const YOCTO_PER_BYTE = 10_000_000_000_000_000_000n;

type Module = Record<string, any>;

function fromCdn(pkg: string): Promise<Module> {
  const url = `https://cdn.jsdelivr.net/npm/@near-wallet-selector/${pkg}@${SELECTOR_VERSION}/+esm`;
  return import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
}

async function ensureBuffer() {
  if (!(globalThis as { Buffer?: unknown }).Buffer) {
    const { Buffer } = await import("buffer");
    (globalThis as { Buffer?: unknown }).Buffer = Buffer;
  }
}

let corePromise: Promise<Module> | undefined;
function core(): Promise<Module> {
  if (!corePromise) corePromise = fromCdn("core");
  return corePromise;
}

let selectorPromise: Promise<any> | undefined;
function selector(): Promise<any> {
  if (!selectorPromise) {
    selectorPromise = (async () => {
      await ensureBuffer();
      const [c, meteor, intear, sender] = await Promise.all([core(), fromCdn("meteor-wallet"), fromCdn("intear-wallet"), fromCdn("sender")]);
      return c.setupWalletSelector({ network: "testnet", modules: [meteor.setupMeteorWallet(), intear.setupIntearWallet(), sender.setupSender()] });
    })().catch((e) => {
      selectorPromise = undefined;
      throw e;
    });
  }
  return selectorPromise;
}

export interface NearWalletOption {
  id: string;
  name: string;
  icon?: string;
  type: string;
  available: boolean;
}

export interface NearFunctionCall {
  methodName: string;
  args: Record<string, unknown>;
  gas: string;
  deposit: string;
}

interface NearState {
  status: "idle" | "connecting" | "connected";
  accountId?: string;
  walletName?: string;
  walletIcon?: string;
  options: NearWalletOption[];
  loading: boolean;
  error?: string;
}

function rejected(e: unknown): boolean {
  return /reject|declin|cancel|denied|closed/i.test(String((e as Error)?.message ?? e));
}

export function useNearWallet() {
  const [state, setState] = useState<NearState>({ status: "idle", options: [], loading: false });
  const walletRef = useRef<any>(undefined);
  const accountRef = useRef<string | undefined>(undefined);

  const discover = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const sel = await selector();
      const modules = sel.store.getState().modules as Array<{ id: string; type: string; metadata: { name: string; iconUrl?: string; available?: boolean; deprecated?: boolean } }>;
      const options = modules.map((m) => ({ id: m.id, name: m.metadata.name, icon: m.metadata.iconUrl, type: m.type, available: m.metadata.available !== false && !m.metadata.deprecated }));
      setState((s) => ({ ...s, options, loading: false }));
      if (!accountRef.current && sel.isSignedIn()) {
        const wallet = await sel.wallet();
        const accounts = await wallet.getAccounts();
        const meta = options.find((o) => o.id === wallet.id);
        if (accounts?.[0]?.accountId) {
          walletRef.current = wallet;
          accountRef.current = accounts[0].accountId;
          setState((s) => ({ ...s, status: "connected", accountId: accounts[0].accountId, walletName: meta?.name, walletIcon: meta?.icon }));
        }
      }
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: `NEAR wallets couldn't load: ${String((e as Error)?.message ?? e)}` }));
    }
  }, []);

  const connect = useCallback(async (option: NearWalletOption, contractId?: string) => {
    setState((s) => ({ ...s, status: "connecting", error: undefined }));
    try {
      const sel = await selector();
      const wallet = await sel.wallet(option.id);
      const existing = await wallet.getAccounts().catch(() => []);
      const accounts = existing?.length ? existing : await wallet.signIn({ contractId, methodNames: [] });
      const accountId = accounts?.[0]?.accountId;
      if (!accountId) throw new Error(`${option.name} didn't return an account.`);
      walletRef.current = wallet;
      accountRef.current = accountId;
      setState((s) => ({ ...s, status: "connected", accountId, walletName: option.name, walletIcon: option.icon }));
      return true;
    } catch (e) {
      setState((s) => ({ ...s, status: "idle", error: rejected(e) ? `You declined the connection in ${option.name}.` : String((e as Error)?.message ?? e) }));
      return false;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await walletRef.current?.signOut();
    } catch {}
    walletRef.current = undefined;
    accountRef.current = undefined;
    setState((s) => ({ ...s, status: "idle", accountId: undefined, walletName: undefined, walletIcon: undefined }));
  }, []);

  const send = useCallback(async (receiverId: string, calls: NearFunctionCall[]): Promise<string> => {
    const wallet = walletRef.current;
    const signerId = accountRef.current;
    if (!wallet || !signerId) throw new Error("Connect a NEAR wallet first.");
    const { internalActionToNaj } = await core();
    try {
      const outcome = await wallet.signAndSendTransaction({
        signerId,
        receiverId,
        actions: calls.map((params) => internalActionToNaj({ type: "FunctionCall", params })),
      });
      return outcome?.transaction?.hash ?? outcome?.transaction_outcome?.id ?? "";
    } catch (e) {
      if (rejected(e)) throw Object.assign(new Error("Transaction cancelled in the wallet."), { code: "WALLET_REJECTED" });
      throw e;
    }
  }, []);

  const adapter = useCallback(() => {
    const accountId = accountRef.current;
    if (!accountId) return undefined;
    return {
      getAccounts: async () => [{ accountId }],
      signAndSendTransaction: async ({ receiverId, actions }: { receiverId: string; actions: Array<{ params: NearFunctionCall }> }) => {
        const wallet = walletRef.current;
        const { internalActionToNaj } = await core();
        try {
          return await wallet.signAndSendTransaction({
            signerId: accountId,
            receiverId,
            actions: actions.map((a) => internalActionToNaj({ type: "FunctionCall", params: a.params })),
          });
        } catch (e) {
          if (rejected(e)) throw Object.assign(new Error("Payment was rejected in the NEAR wallet."), { code: "WALLET_REJECTED" });
          throw e;
        }
      },
    };
  }, []);

  return { ...state, discover, connect, disconnect, adapter, send };
}

async function rpc(network: ConsoleNetwork, params: Record<string, unknown>): Promise<any> {
  const r = await fetch(network.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "query", params: { finality: "final", ...params } }),
  });
  const body = await r.json();
  if (body.error) throw new Error(body.error?.cause?.name ?? body.error?.message ?? "NEAR RPC error");
  return body.result;
}

async function view<T>(network: ConsoleNetwork, accountId: string, method: string, args: Record<string, unknown>): Promise<T> {
  const result = await rpc(network, { request_type: "call_function", account_id: accountId, method_name: method, args_base64: btoa(JSON.stringify(args)) });
  const text = new TextDecoder().decode(new Uint8Array(result.result));
  return (text ? JSON.parse(text) : null) as T;
}

function toNumber(raw: bigint, decimals: number): number {
  const base = 10n ** BigInt(decimals);
  return Number(raw / base) + Number(raw % base) / Number(base);
}

export async function nearBalances(network: ConsoleNetwork, accountId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  try {
    const account = await rpc(network, { request_type: "view_account", account_id: accountId });
    const available = BigInt(account.amount) - BigInt(account.storage_usage) * YOCTO_PER_BYTE;
    out[network.native.symbol] = toNumber(available > 0n ? available : 0n, network.native.decimals);
  } catch {
    out[network.native.symbol] = 0;
  }
  await Promise.all(
    network.tokens.map(async (t) => {
      try {
        out[t.symbol] = toNumber(BigInt((await view<string>(network, t.address, "ft_balance_of", { account_id: accountId })) ?? "0"), t.decimals);
      } catch {
        out[t.symbol] = 0;
      }
    }),
  );
  return out;
}

export async function mintNearTestToken(
  network: ConsoleNetwork,
  token: ConsoleToken,
  accountId: string,
  amount: number,
  send: (receiverId: string, calls: NearFunctionCall[]) => Promise<string>,
): Promise<string> {
  const registered = await view<unknown>(network, token.address, "storage_balance_of", { account_id: accountId });
  const calls: NearFunctionCall[] = [];
  if (!registered) calls.push({ methodName: "storage_deposit", args: { account_id: accountId, registration_only: true }, gas: MINT_GAS, deposit: STORAGE_DEPOSIT });
  calls.push({ methodName: "mint", args: { account_id: accountId, amount: (BigInt(amount) * 10n ** BigInt(token.decimals)).toString() }, gas: MINT_GAS, deposit: "0" });
  return send(token.address, calls);
}
