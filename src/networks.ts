export type Ecosystem = "evm" | "sui" | "stellar" | "near";

export type TokenSource =
  | { kind: "kwespay"; maxPerRequest: number }
  | { kind: "circle" }
  | { kind: "stellar-swap" }
  | { kind: "near-mint"; amount: number }
  | { kind: "none" };

export interface ConsoleToken {
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  stable: boolean;
  source: TokenSource;
}

export interface ConsoleNetwork {
  key: string;
  name: string;
  ecosystem: Ecosystem;
  chainId?: number;
  rpcUrl: string;
  explorer: string;
  explorerTx: string;
  explorerAddress: string;
  native: { symbol: string; name: string; decimals: number };
  gasFaucet?: { kind: "link"; url: string } | { kind: "sui" } | { kind: "friendbot" };
  tokens: ConsoleToken[];
}

const circleUsdc = (address: string): ConsoleToken => ({
  symbol: "USDC",
  name: "Test USDC",
  address,
  decimals: 6,
  stable: true,
  source: { kind: "circle" },
});

const kwespayUsdt = (address: string): ConsoleToken => ({
  symbol: "USDT",
  name: "Test USDT",
  address,
  decimals: 6,
  stable: true,
  source: { kind: "kwespay", maxPerRequest: 10_000 },
});

export const NEAR_TESTNET_RPC = "https://test.rpc.fastnear.com";

export const STELLAR_TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const STELLAR_HORIZON = "https://horizon-testnet.stellar.org";
export const STELLAR_USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const TESTNET_NETWORKS: ConsoleNetwork[] = [
  {
    key: "baseSepolia",
    name: "Base Sepolia",
    ecosystem: "evm",
    chainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    explorer: "https://sepolia.basescan.org",
    explorerTx: "https://sepolia.basescan.org/tx/",
    explorerAddress: "https://sepolia.basescan.org/address/",
    native: { symbol: "ETH", name: "Base Sepolia ETH", decimals: 18 },
    gasFaucet: { kind: "link", url: "https://portal.cdp.coinbase.com/products/faucet" },
    tokens: [circleUsdc("0x036CbD53842c5426634e7929541eC2318f3dCF7e"), kwespayUsdt("0x08d6367e9d07B5C9fD5F58E8B29228E7b48fb703")],
  },
  {
    key: "sepolia",
    name: "Ethereum Sepolia",
    ecosystem: "evm",
    chainId: 11155111,
    rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
    explorer: "https://sepolia.etherscan.io",
    explorerTx: "https://sepolia.etherscan.io/tx/",
    explorerAddress: "https://sepolia.etherscan.io/address/",
    native: { symbol: "ETH", name: "Sepolia ETH", decimals: 18 },
    gasFaucet: { kind: "link", url: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia" },
    tokens: [kwespayUsdt("0x01aA0fA6F8Ce7a836b802BAEEBD527e459525f25")],
  },
  {
    key: "polygonAmoy",
    name: "Polygon Amoy",
    ecosystem: "evm",
    chainId: 80002,
    rpcUrl: "https://polygon-amoy-bor-rpc.publicnode.com",
    explorer: "https://amoy.polygonscan.com",
    explorerTx: "https://amoy.polygonscan.com/tx/",
    explorerAddress: "https://amoy.polygonscan.com/address/",
    native: { symbol: "POL", name: "Amoy POL", decimals: 18 },
    gasFaucet: { kind: "link", url: "https://faucet.polygon.technology" },
    tokens: [
      kwespayUsdt("0x771040C8bd22C826f9e46a6375888F32FA884739"),
      { symbol: "USDC", name: "Test USDC", address: "0x8B0180f2101c8260d49339abfEe87927412494B4", decimals: 6, stable: true, source: { kind: "none" } },
    ],
  },
  {
    key: "arbitrumSepolia",
    name: "Arbitrum Sepolia",
    ecosystem: "evm",
    chainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    explorer: "https://sepolia.arbiscan.io",
    explorerTx: "https://sepolia.arbiscan.io/tx/",
    explorerAddress: "https://sepolia.arbiscan.io/address/",
    native: { symbol: "ETH", name: "Arbitrum Sepolia ETH", decimals: 18 },
    gasFaucet: { kind: "link", url: "https://www.alchemy.com/faucets/arbitrum-sepolia" },
    tokens: [
      circleUsdc("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"),
      kwespayUsdt("0xEEBfE4Bb1C0D4b691424f5ef5197b080D3E4639c"),
      { symbol: "ARB", name: "Test ARB", address: "0x15dd68a7a37d7edBf284b93Bc25d6b286d33fCc3", decimals: 18, stable: false, source: { kind: "kwespay", maxPerRequest: 10_000 } },
    ],
  },
  {
    key: "suiTestnet",
    name: "Sui Testnet",
    ecosystem: "sui",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    explorer: "https://suiscan.xyz/testnet",
    explorerTx: "https://suiscan.xyz/testnet/tx/",
    explorerAddress: "https://suiscan.xyz/testnet/account/",
    native: { symbol: "SUI", name: "Test SUI", decimals: 9 },
    gasFaucet: { kind: "sui" },
    tokens: [],
  },
  {
    key: "stellarTestnet",
    name: "Stellar Testnet",
    ecosystem: "stellar",
    rpcUrl: "https://soroban-testnet.stellar.org",
    explorer: "https://stellar.expert/explorer/testnet",
    explorerTx: "https://stellar.expert/explorer/testnet/tx/",
    explorerAddress: "https://stellar.expert/explorer/testnet/account/",
    native: { symbol: "XLM", name: "Test XLM", decimals: 7 },
    gasFaucet: { kind: "friendbot" },
    tokens: [
      { symbol: "USDC", name: "Test USDC", address: STELLAR_USDC_ISSUER, decimals: 7, stable: true, source: { kind: "stellar-swap" } },
    ],
  },
  {
    key: "nearTestnet",
    name: "NEAR Testnet",
    ecosystem: "near",
    rpcUrl: NEAR_TESTNET_RPC,
    explorer: "https://testnet.nearblocks.io",
    explorerTx: "https://testnet.nearblocks.io/txns/",
    explorerAddress: "https://testnet.nearblocks.io/address/",
    native: { symbol: "NEAR", name: "Test NEAR", decimals: 24 },
    gasFaucet: { kind: "link", url: "https://near-faucet.io" },
    tokens: [
      { symbol: "USDC.E", name: "Bridged test USDC", address: "usdc.fakes.testnet", decimals: 6, stable: true, source: { kind: "near-mint", amount: 100 } },
      { symbol: "USDT", name: "Bridged test USDT", address: "usdt.fakes.testnet", decimals: 6, stable: true, source: { kind: "near-mint", amount: 100 } },
      circleUsdc("3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af"),
    ],
  },
  {
    key: "liskTestnet",
    name: "Lisk Sepolia",
    ecosystem: "evm",
    chainId: 4202,
    rpcUrl: "https://rpc.sepolia-api.lisk.com",
    explorer: "https://sepolia-blockscout.lisk.com",
    explorerTx: "https://sepolia-blockscout.lisk.com/tx/",
    explorerAddress: "https://sepolia-blockscout.lisk.com/address/",
    native: { symbol: "ETH", name: "Lisk Sepolia ETH", decimals: 18 },
    gasFaucet: { kind: "link", url: "https://sepolia-faucet.lisk.com" },
    tokens: [{ symbol: "LSK", name: "Test LSK", address: "0x8a21CF9Ba08Ae709D64Cb25AfAA951183EC9FF6D", decimals: 18, stable: false, source: { kind: "none" } }],
  },
  {
    key: "mezoTestnet",
    name: "Mezo Testnet",
    ecosystem: "evm",
    chainId: 31611,
    rpcUrl: "https://rpc.test.mezo.org",
    explorer: "https://explorer.test.mezo.org",
    explorerTx: "https://explorer.test.mezo.org/tx/",
    explorerAddress: "https://explorer.test.mezo.org/address/",
    native: { symbol: "BTC", name: "Mezo test BTC", decimals: 18 },
    tokens: [kwespayUsdt("0xd16c9c341Bc15B5db7E25881893CA5a3117bB9A5")],
  },
];

export const ECOSYSTEM_NAME: Record<Ecosystem, string> = { evm: "EVM", sui: "Sui", stellar: "Stellar", near: "NEAR" };

export function networkByKey(key: string): ConsoleNetwork {
  return TESTNET_NETWORKS.find((n) => n.key === key) ?? TESTNET_NETWORKS[0];
}

export function assetsFor(network: ConsoleNetwork): { symbol: string; native: boolean; token?: ConsoleToken }[] {
  return [{ symbol: network.native.symbol, native: true }, ...network.tokens.map((t) => ({ symbol: t.symbol, native: false, token: t }))];
}

export function chainHex(chainId: number): string {
  return `0x${chainId.toString(16)}`;
}
