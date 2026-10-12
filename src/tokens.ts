import { createPublicClient, encodeFunctionData, http, parseUnits, type Hex } from "viem";
import type { ConsoleNetwork, ConsoleToken } from "./networks";
import type { Eip1193 } from "./wallets/evm";

const FAUCET_ABI = [{ type: "function", name: "faucet", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] }] as const;

export async function mintKwespayToken(provider: Eip1193, network: ConsoleNetwork, token: ConsoleToken, from: string, amount: number): Promise<string> {
  const data = encodeFunctionData({ abi: FAUCET_ABI, functionName: "faucet", args: [parseUnits(String(amount), token.decimals)] });
  const hash = (await provider.request({ method: "eth_sendTransaction", params: [{ from, to: token.address, data }] })) as Hex;
  const client = createPublicClient({ transport: http(network.rpcUrl) });
  const receipt = await client.waitForTransactionReceipt({ hash, timeout: 120_000 });
  if (receipt.status !== "success") throw new Error("The mint transaction failed on-chain.");
  return hash;
}

export async function requestTestSui(address: string): Promise<void> {
  const { requestSuiFromFaucetV2, getFaucetHost } = await import("@mysten/sui/faucet");
  await requestSuiFromFaucetV2({ host: getFaucetHost("testnet"), recipient: address });
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
