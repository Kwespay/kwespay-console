const BASE = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/logos`;

export interface LogoAsset {
  src: string;
  mono?: boolean;
}

const asset = (file: string, mono?: boolean): LogoAsset => ({ src: `${BASE}/${file}`, mono });

const CHAIN: Record<string, LogoAsset> = {
  baseSepolia: asset("base.png"),
  sepolia: asset("eth.svg"),
  polygonAmoy: asset("pol.png"),
  arbitrumSepolia: asset("arbitrum.svg"),
  liskTestnet: asset("lisk.png", true),
  mezoTestnet: asset("mezo.png"),
  suiTestnet: asset("sui.svg"),
  stellarTestnet: asset("stellar.png", true),
};

const TOKEN: Record<string, LogoAsset> = {
  ETH: asset("eth.svg"),
  USDC: asset("usdc.svg"),
  USDT: asset("usdt.svg"),
  ARB: asset("arb.svg"),
  POL: asset("pol.png"),
  SUI: asset("sui.svg"),
  XLM: asset("stellar.png", true),
  LSK: asset("lsk.png", true),
  BTC: asset("btc.svg"),
};

export function chainLogo(networkKey: string): LogoAsset | undefined {
  return CHAIN[networkKey];
}

export function tokenLogo(symbol: string): LogoAsset | undefined {
  return TOKEN[symbol.toUpperCase()];
}
