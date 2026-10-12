import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function sdkVersion(): string {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "node_modules/@kwespay/client/package.json"), "utf8")).version ?? "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_SDK_VERSION: sdkVersion() },
};

export default nextConfig;
