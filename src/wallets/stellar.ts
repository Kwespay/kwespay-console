"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STELLAR_HORIZON, STELLAR_TESTNET_PASSPHRASE, STELLAR_USDC_ISSUER } from "../networks";

type Freighter = typeof import("@stellar/freighter-api");

let freighterMod: Promise<Freighter> | undefined;
function freighter(): Promise<Freighter> {
  if (!freighterMod) freighterMod = import("@stellar/freighter-api");
  return freighterMod;
}

function apiError(e: unknown): string | undefined {
  if (!e) return undefined;
  const m = (e as { message?: string }).message ?? String(e);
  return m;
}

export interface StellarWalletState {
  installed: boolean | null;
  status: "idle" | "connecting" | "connected";
  address?: string;
  networkPassphrase?: string;
  error?: string;
}

export function useStellarWallet() {
  const [state, setState] = useState<StellarWalletState>({ installed: null, status: "idle" });
  const addressRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      const f = await freighter();
      const c = await f.isConnected();
      if (!alive) return;
      const installed = Boolean(c.isConnected) && !c.error;
      setState((s) => ({ ...s, installed }));
      if (!installed) return;
      const allowed = await f.isAllowed();
      if (!alive || !allowed.isAllowed) return;
      const [addr, net] = await Promise.all([f.getAddress(), f.getNetworkDetails()]);
      if (!alive || !addr.address) return;
      addressRef.current = addr.address;
      setState((s) => ({ ...s, status: "connected", address: addr.address, networkPassphrase: net.networkPassphrase }));
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (state.status !== "connected") return;
    let watcher: { stop(): void } | undefined;
    void freighter().then((f) => {
      const w = new f.WatchWalletChanges(2000);
      w.watch(({ address, networkPassphrase, error }) => {
        if (error) return;
        if (!address) {
          addressRef.current = undefined;
          setState((s) => ({ ...s, status: "idle", address: undefined }));
          return;
        }
        addressRef.current = address;
        setState((s) => ({ ...s, address, networkPassphrase }));
      });
      watcher = w;
    });
    return () => watcher?.stop();
  }, [state.status]);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, status: "connecting", error: undefined }));
    const f = await freighter();
    const c = await f.isConnected();
    if (!c.isConnected) {
      setState((s) => ({ ...s, installed: false, status: "idle", error: "Freighter is not installed." }));
      return false;
    }
    const res = await f.requestAccess();
    if (res.error || !res.address) {
      setState((s) => ({ ...s, status: "idle", error: "You declined the connection request in Freighter." }));
      return false;
    }
    const net = await f.getNetworkDetails();
    addressRef.current = res.address;
    setState((s) => ({ ...s, installed: true, status: "connected", address: res.address, networkPassphrase: net.networkPassphrase, error: undefined }));
    return true;
  }, []);

  const disconnect = useCallback(() => {
    addressRef.current = undefined;
    setState((s) => ({ ...s, status: "idle", address: undefined, error: undefined }));
  }, []);

  const signXdr = useCallback(async (xdr: string): Promise<string> => {
    const f = await freighter();
    const r = await f.signTransaction(xdr, { networkPassphrase: STELLAR_TESTNET_PASSPHRASE, address: addressRef.current });
    if (r.error || !r.signedTxXdr) {
      const err = new Error(apiError(r.error) ?? "Freighter did not sign the transaction.") as Error & { code: number };
      err.code = 4001;
      throw err;
    }
    return r.signedTxXdr;
  }, []);

  const adapter = useCallback(() => {
    const address = addressRef.current;
    if (!address) return undefined;
    return {
      async getAddress() {
        return { address };
      },
      async signTransaction(xdr: string) {
        return { signedTxXdr: await signXdr(xdr) };
      },
    };
  }, [signXdr]);

  const onTestnet = state.networkPassphrase === undefined || state.networkPassphrase === STELLAR_TESTNET_PASSPHRASE;

  return { ...state, onTestnet, connect, disconnect, adapter, signXdr };
}

export interface StellarAccountInfo {
  exists: boolean;
  xlm: number;
  usdc: number;
  usdcEnabled: boolean;
}

export async function stellarAccount(address: string): Promise<StellarAccountInfo> {
  const r = await fetch(`${STELLAR_HORIZON}/accounts/${address}`);
  if (r.status === 404) return { exists: false, xlm: 0, usdc: 0, usdcEnabled: false };
  if (!r.ok) throw new Error(`Horizon ${r.status}`);
  const d = (await r.json()) as { balances: { asset_type: string; asset_code?: string; asset_issuer?: string; balance: string }[] };
  const xlm = Number(d.balances.find((b) => b.asset_type === "native")?.balance ?? 0);
  const usdc = d.balances.find((b) => b.asset_code === "USDC" && b.asset_issuer === STELLAR_USDC_ISSUER);
  return { exists: true, xlm, usdc: Number(usdc?.balance ?? 0), usdcEnabled: Boolean(usdc) };
}

async function submitClassic(address: string, build: (sdk: typeof import("@stellar/stellar-sdk"), tb: import("@stellar/stellar-sdk").TransactionBuilder) => void, sign: (xdr: string) => Promise<string>): Promise<string> {
  const sdk = await import("@stellar/stellar-sdk");
  const server = new sdk.Horizon.Server(STELLAR_HORIZON);
  const account = await server.loadAccount(address);
  const tb = new sdk.TransactionBuilder(account, { fee: "1000", networkPassphrase: STELLAR_TESTNET_PASSPHRASE });
  build(sdk, tb);
  const tx = tb.setTimeout(180).build();
  const signed = await sign(tx.toXDR());
  const res = await server.submitTransaction(sdk.TransactionBuilder.fromXDR(signed, STELLAR_TESTNET_PASSPHRASE));
  return (res as { hash: string }).hash;
}

export function enableUsdc(address: string, sign: (xdr: string) => Promise<string>): Promise<string> {
  return submitClassic(address, (sdk, tb) => tb.addOperation(sdk.Operation.changeTrust({ asset: new sdk.Asset("USDC", STELLAR_USDC_ISSUER) })), sign);
}

export function buyTestUsdc(address: string, amount: string, sign: (xdr: string) => Promise<string>): Promise<string> {
  return submitClassic(
    address,
    (sdk, tb) =>
      tb.addOperation(
        sdk.Operation.pathPaymentStrictReceive({
          sendAsset: sdk.Asset.native(),
          sendMax: String(Math.ceil(Number(amount) * 3)),
          destination: address,
          destAsset: new sdk.Asset("USDC", STELLAR_USDC_ISSUER),
          destAmount: amount,
          path: [],
        }),
      ),
    sign,
  );
}

export async function friendbot(address: string): Promise<void> {
  const r = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(address)}`);
  if (!r.ok && r.status !== 400) throw new Error(`Friendbot ${r.status}`);
}
