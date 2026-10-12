"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, erc20Abi, formatUnits, http, type Address } from "viem";
import { chainHex, type ConsoleNetwork } from "../networks";
import { readLocal, writeLocal } from "../storage";

export interface Eip1193 {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: any[]) => void): void;
  removeListener?(event: string, handler: (...args: any[]) => void): void;
}

export interface EvmWalletOption {
  id: string;
  name: string;
  icon?: string;
  provider: Eip1193;
}

export type EvmStatus = "idle" | "connecting" | "connected";

export interface EvmWalletState {
  options: EvmWalletOption[];
  status: EvmStatus;
  wallet?: EvmWalletOption;
  address?: string;
  chainId?: number;
  error?: string;
}

const KNOWN_CHAINS: Record<number, string> = {
  1: "Ethereum Mainnet",
  8453: "Base",
  137: "Polygon",
  42161: "Arbitrum One",
  10: "Optimism",
  56: "BNB Chain",
  1135: "Lisk",
  11155111: "Ethereum Sepolia",
  84532: "Base Sepolia",
  80002: "Polygon Amoy",
  421614: "Arbitrum Sepolia",
  4202: "Lisk Sepolia",
  31611: "Mezo Testnet",
};

export function chainName(id?: number): string {
  if (id === undefined) return "an unknown network";
  return KNOWN_CHAINS[id] ?? `network ${id}`;
}

function errorCode(e: unknown): number | undefined {
  const c = (e as { code?: unknown })?.code;
  return typeof c === "number" ? c : undefined;
}

export function isUserRejection(e: unknown): boolean {
  return errorCode(e) === 4001 || /reject|denied|cancel/i.test(String((e as Error)?.message ?? e));
}

function discover(onFound: (o: EvmWalletOption) => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent).detail as { info: { uuid: string; name: string; icon: string; rdns: string }; provider: Eip1193 };
    if (detail?.info && detail.provider) onFound({ id: detail.info.rdns || detail.info.uuid, name: detail.info.name, icon: detail.info.icon, provider: detail.provider });
  };
  window.addEventListener("eip6963:announceProvider", handler);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  return () => window.removeEventListener("eip6963:announceProvider", handler);
}

function legacyOption(): EvmWalletOption | undefined {
  const eth = (window as unknown as { ethereum?: Eip1193 & { isMetaMask?: boolean; isRabby?: boolean; isCoinbaseWallet?: boolean } }).ethereum;
  if (!eth) return undefined;
  const name = eth.isRabby ? "Rabby" : eth.isCoinbaseWallet ? "Coinbase Wallet" : eth.isMetaMask ? "MetaMask" : "Browser wallet";
  return { id: "injected", name, provider: eth };
}

export function useEvmWallet() {
  const [state, setState] = useState<EvmWalletState>({ options: [], status: "idle" });
  const walletRef = useRef<EvmWalletOption | undefined>(undefined);

  useEffect(() => {
    const found = new Map<string, EvmWalletOption>();
    const publish = () => setState((s) => ({ ...s, options: Array.from(found.values()) }));
    const stop = discover((o) => {
      found.set(o.id, o);
      publish();
    });
    const t = setTimeout(() => {
      if (found.size === 0) {
        const legacy = legacyOption();
        if (legacy) {
          found.set(legacy.id, legacy);
          publish();
        }
      }
    }, 400);
    return () => {
      stop();
      clearTimeout(t);
    };
  }, []);

  const attach = useCallback(async (wallet: EvmWalletOption, interactive: boolean) => {
    setState((s) => ({ ...s, status: "connecting", error: undefined }));
    try {
      const accounts = (await wallet.provider.request({ method: interactive ? "eth_requestAccounts" : "eth_accounts" })) as string[];
      if (!accounts?.length) {
        setState((s) => ({ ...s, status: "idle", wallet: undefined, address: undefined }));
        return false;
      }
      const chain = (await wallet.provider.request({ method: "eth_chainId" })) as string;
      walletRef.current = wallet;
      writeLocal("kp-evm-wallet", wallet.id);
      setState((s) => ({ ...s, status: "connected", wallet, address: accounts[0], chainId: parseInt(chain, 16), error: undefined }));
      return true;
    } catch (e) {
      setState((s) => ({
        ...s,
        status: "idle",
        error: isUserRejection(e) ? `You declined the connection request in ${wallet.name}.` : `${wallet.name} couldn't connect. ${(e as Error)?.message ?? ""}`.trim(),
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    const saved = readLocal("kp-evm-wallet");
    if (!saved || state.status !== "idle" || walletRef.current) return;
    const w = state.options.find((o) => o.id === saved);
    if (w) void attach(w, false);
  }, [state.options, state.status, attach]);

  useEffect(() => {
    const w = state.wallet;
    if (!w?.provider.on) return;
    const onAccounts = (accounts: string[]) => {
      if (!accounts?.length) {
        walletRef.current = undefined;
        writeLocal("kp-evm-wallet", "");
        setState((s) => ({ ...s, status: "idle", wallet: undefined, address: undefined, chainId: undefined }));
      } else setState((s) => ({ ...s, address: accounts[0] }));
    };
    const onChain = (id: string) => setState((s) => ({ ...s, chainId: parseInt(id, 16) }));
    const onDisconnect = () => {
      walletRef.current = undefined;
      setState((s) => ({ ...s, status: "idle", wallet: undefined, address: undefined, chainId: undefined }));
    };
    w.provider.on("accountsChanged", onAccounts);
    w.provider.on("chainChanged", onChain);
    w.provider.on("disconnect", onDisconnect);
    return () => {
      w.provider.removeListener?.("accountsChanged", onAccounts);
      w.provider.removeListener?.("chainChanged", onChain);
      w.provider.removeListener?.("disconnect", onDisconnect);
    };
  }, [state.wallet]);

  const connect = useCallback((wallet: EvmWalletOption) => attach(wallet, true), [attach]);

  const disconnect = useCallback(async () => {
    const w = walletRef.current;
    walletRef.current = undefined;
    writeLocal("kp-evm-wallet", "");
    try {
      await w?.provider.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] });
    } catch {}
    setState((s) => ({ ...s, status: "idle", wallet: undefined, address: undefined, chainId: undefined, error: undefined }));
  }, []);

  const switchTo = useCallback(async (network: ConsoleNetwork): Promise<string | undefined> => {
    const w = walletRef.current;
    if (!w || !network.chainId) return "Connect a wallet first.";
    const chainId = chainHex(network.chainId);
    try {
      await w.provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
      return undefined;
    } catch (e) {
      if (isUserRejection(e)) return `You declined the network switch in ${w.name}.`;
      if (errorCode(e) === 4902 || /unrecognized|not added|unknown chain/i.test(String((e as Error)?.message))) {
        try {
          await w.provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId,
                chainName: network.name,
                nativeCurrency: { name: network.native.name, symbol: network.native.symbol, decimals: network.native.decimals },
                rpcUrls: [network.rpcUrl],
                blockExplorerUrls: [network.explorer],
              },
            ],
          });
          return undefined;
        } catch (e2) {
          return isUserRejection(e2) ? `You declined adding ${network.name} in ${w.name}.` : `${w.name} couldn't add ${network.name}.`;
        }
      }
      return `${w.name} couldn't switch to ${network.name}.`;
    }
  }, []);

  return { ...state, connect, disconnect, switchTo };
}

export interface Balance {
  symbol: string;
  amount: number;
  raw: bigint;
  decimals: number;
}

export async function evmBalances(network: ConsoleNetwork, owner: string): Promise<Balance[]> {
  const client = createPublicClient({ transport: http(network.rpcUrl) });
  const native = await client.getBalance({ address: owner as Address });
  const out: Balance[] = [{ symbol: network.native.symbol, raw: native, decimals: network.native.decimals, amount: Number(formatUnits(native, network.native.decimals)) }];
  const tokens = await Promise.all(
    network.tokens.map(async (t) => {
      try {
        const raw = (await client.readContract({ address: t.address as Address, abi: erc20Abi, functionName: "balanceOf", args: [owner as Address] })) as bigint;
        return { symbol: t.symbol, raw, decimals: t.decimals, amount: Number(formatUnits(raw, t.decimals)) };
      } catch {
        return { symbol: t.symbol, raw: BigInt(0), decimals: t.decimals, amount: 0 };
      }
    }),
  );
  return out.concat(tokens);
}
