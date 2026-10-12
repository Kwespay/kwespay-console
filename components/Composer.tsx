"use client";

import type { ReactNode } from "react";
import { currencySymbol } from "@/src/currencies";
import type { ConsoleNetwork } from "@/src/networks";
import { CurrencyPicker } from "./CurrencyPicker";
import { Button, ChainLogo, CopyButton, Icon, Mono, Spinner, StatusDot, TokenLogo, cx, formatAmount, formatFiat, shortAddress } from "./ui";

export interface AssetChoice {
  symbol: string;
  name: string;
  available: boolean;
  reason?: string;
  balance?: number;
}

export interface Preview {
  state: "idle" | "loading" | "ok" | "error";
  amount?: number;
  total?: number;
  fee?: number;
  message?: string;
}

export interface Issue {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void; primary?: boolean };
}

export interface Readiness {
  tone: "ready" | "hint" | "warn";
  title: string;
  message?: string;
  step?: number;
  action?: Issue["action"];
  more?: Issue[];
  allowSend?: boolean;
}

export interface AccountView {
  connected: boolean;
  connecting: boolean;
  vendorName?: string;
  error?: string;
}

export interface WalletView {
  connected: boolean;
  connecting: boolean;
  name: string;
  icon?: string;
  address?: string;
  error?: string;
}

function IdentityRow({ label, children, aside }: { label: string; children: ReactNode; aside: ReactNode }) {
  return (
    <div className="flex min-h-[60px] items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[11.5px] text-muted">{label}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">{children}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{aside}</div>
    </div>
  );
}

function Connected() {
  return (
    <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:inline-flex">
      <StatusDot tone="ok" />
      Connected
    </span>
  );
}

function ReadinessArea({ readiness }: { readiness: Readiness }) {
  if (readiness.tone === "ready")
    return (
      <div key="ready" className="flex h-9 animate-kp-in items-center gap-2 text-[13px] font-medium text-ok">
        <Icon name="check" strokeWidth={2} className="size-3.5" />
        {readiness.title}
        {readiness.message && <span className="ml-auto text-[12px] font-normal text-muted">{readiness.message}</span>}
      </div>
    );
  if (readiness.tone === "hint")
    return (
      <div key={readiness.title} className="flex h-9 animate-kp-in items-center gap-2.5 text-[13px] text-text-2">
        <StatusDot tone="brand" />
        <span className="min-w-0 truncate">{readiness.title}</span>
        {readiness.step && <span className="ml-auto shrink-0 font-mono text-[11px] text-faint tnum">{readiness.step} / 3</span>}
      </div>
    );
  const items: Issue[] = [{ title: readiness.title, message: readiness.message ?? "", action: readiness.action }, ...(readiness.more ?? [])];
  return (
    <div key={readiness.title} role="status" className="animate-kp-in divide-y divide-warn/15 overflow-hidden rounded-[var(--radius-sm)] border border-warn/20 bg-warn-bg">
      {items.map((i) => (
        <div key={i.title} className="flex items-start gap-3 px-3.5 py-3">
          <Icon name="alert" className="mt-px size-3.5 text-warn" />
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-text">{i.title}</div>
            {i.message && <div className="mt-0.5 text-[12.5px] leading-[1.45] text-text-2">{i.message}</div>}
          </div>
          {i.action && (
            <Button size="xs" variant={i.action.primary ? "primary" : "secondary"} onClick={i.action.onClick} className="-my-0.5">
              {i.action.label}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[3px]">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className={cx("text-right font-mono text-[12.5px] tnum", strong ? "font-medium text-text" : "text-text-2")}>{children}</dd>
    </div>
  );
}

function Shimmer({ w }: { w: string }) {
  return <span className={cx("inline-block h-2.5 animate-kp-shimmer rounded-[3px] bg-surface-3 align-middle", w)} />;
}

export function Composer({
  network,
  account,
  onOpenAccount,
  onShowCode,
  wallet,
  onOpenWallet,
  onDisconnectWallet,
  assets,
  asset,
  onAsset,
  amount,
  onAmount,
  currency,
  onCurrency,
  preview,
  readiness,
  running,
  onPay,
  error,
}: {
  network: ConsoleNetwork;
  account: AccountView;
  onOpenAccount: () => void;
  onShowCode: () => void;
  wallet: WalletView;
  onOpenWallet: () => void;
  onDisconnectWallet: () => void;
  assets: AssetChoice[];
  asset: string;
  onAsset: (s: string) => void;
  amount: string;
  onAmount: (s: string) => void;
  currency: string;
  onCurrency: (s: string) => void;
  preview: Preview;
  readiness?: Readiness;
  running: boolean;
  onPay: () => void;
  error?: string;
}) {
  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value > 0;
  const ready = readiness?.tone === "ready" || Boolean(readiness?.allowSend);
  const feePct = preview.amount && preview.fee ? (preview.fee / preview.amount) * 100 : undefined;
  const symbol = currencySymbol(currency);
  const nextIsAccount = !account.connected;
  const nextIsWallet = account.connected && !wallet.connected;

  return (
    <div className="flex flex-col p-5 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-text">Make a test payment</h1>
          <p className="mt-1 text-[13px] text-muted">
            Send a real testnet transaction through <span className="font-mono text-[12px] text-text-2">@kwespay/client</span>.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onShowCode} className="mt-0.5 gap-1.5">
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5" />
          </svg>
          View code
        </Button>
      </div>

      <div className="mt-6 divide-y divide-hairline rounded-[var(--radius-md)] border border-border">
        <IdentityRow
          label="KwesPay account"
          aside={
            account.connected ? (
              <>
                <Connected />
                <Button variant="ghost" size="xs" onClick={onOpenAccount}>
                  Change
                </Button>
              </>
            ) : (
              <Button variant={nextIsAccount ? "primary" : "secondary"} size="sm" onClick={onOpenAccount} loading={account.connecting}>
                {account.connecting ? "Connecting" : "Connect"}
              </Button>
            )
          }
        >
          {account.connected ? (
            <span className="truncate text-[14px] font-medium text-text">{account.vendorName || "Merchant"}</span>
          ) : account.error ? (
            <span className="truncate text-[13px] text-error">{account.error}</span>
          ) : (
            <span className="truncate text-[13px] text-muted">Use your API key and Vendor ID</span>
          )}
        </IdentityRow>

        <IdentityRow
          label="Wallet"
          aside={
            wallet.connected ? (
              <>
                <Connected />
                <Button variant="ghost" size="xs" onClick={onDisconnectWallet}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Button variant={nextIsWallet ? "primary" : "secondary"} size="sm" onClick={onOpenWallet} loading={wallet.connecting}>
                {wallet.connecting ? "Connecting" : "Connect wallet"}
              </Button>
            )
          }
        >
          {wallet.connected ? (
            <>
              {wallet.icon && <img src={wallet.icon} alt="" className="size-4 rounded-[3px]" />}
              <span className="truncate text-[14px] font-medium text-text">{wallet.name}</span>
              <Mono className="text-muted" title={wallet.address}>
                {shortAddress(wallet.address ?? "", 5, 4)}
              </Mono>
              <CopyButton value={wallet.address ?? ""} label={undefined} className="-ml-1" />
            </>
          ) : wallet.error ? (
            <span className="truncate text-[13px] text-error">{wallet.error}</span>
          ) : (
            <span className="truncate text-[13px] text-muted">No wallet connected</span>
          )}
        </IdentityRow>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-[12px] font-medium text-text-2">Pay with</span>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
            <ChainLogo network={network.key} size={12} />
            {network.name}
          </span>
        </div>
        <div role="radiogroup" aria-label="Token" className="grid auto-cols-fr grid-flow-col gap-1 rounded-[var(--radius-md)] bg-surface-3 p-1">
          {assets.map((a) => {
            const active = a.symbol === asset;
            return (
              <button
                key={a.symbol}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!a.available || running}
                title={a.reason ?? a.name}
                onClick={() => onAsset(a.symbol)}
                className={cx(
                  "flex min-w-0 flex-col items-start rounded-[var(--radius-sm)] px-3 py-2 text-left transition-[background-color,box-shadow,color] duration-150 ease-out",
                  active ? "bg-surface shadow-[0_1px_2px_rgba(15,18,24,0.06),0_0_0_1px_var(--kp-border)]" : "hover:bg-[color-mix(in_srgb,var(--kp-surface)_55%,transparent)]",
                  !a.available && "opacity-55",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <TokenLogo symbol={a.symbol} size={16} className={cx(!active && "opacity-90")} />
                  <span className={cx("text-[13px]", active ? "font-semibold text-text" : "font-medium text-text-2")}>{a.symbol}</span>
                </span>
                <span className="mt-0.5 w-full truncate pl-[22px] font-mono text-[11px] text-muted tnum">{!a.available ? a.reason ?? "Not accepted" : a.balance !== undefined ? formatAmount(a.balance) : a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <label htmlFor="kp-amount" className="mb-2 block text-[12px] font-medium text-text-2">
          Amount
        </label>
        <div
          className={cx(
            "group flex h-[60px] items-center gap-1 rounded-[var(--radius-md)] border bg-inset pr-2 pl-4 shadow-[inset_0_1px_2px_rgba(15,18,24,0.04)] transition-[border-color,box-shadow] duration-150 ease-out",
            "border-border-strong hover:border-[color-mix(in_srgb,var(--kp-border-strong)_60%,var(--kp-text-muted))] focus-within:border-brand! focus-within:shadow-[0_0_0_3px_var(--kp-brand-soft)]",
            running && "opacity-60",
          )}
        >
          {symbol && <span className={cx("font-medium text-faint tnum transition-colors duration-150 group-focus-within:text-muted", symbol.length > 1 ? "mr-1 text-[18px]" : "text-[24px]")}>{symbol}</span>}
          <input
            id="kp-amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            placeholder="0.00"
            onChange={(e) => onAmount(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
            disabled={running}
            className="h-full min-w-0 flex-1 bg-transparent text-[28px] font-medium tracking-[-0.02em] text-text tnum outline-none placeholder:text-faint"
          />
          <CurrencyPicker value={currency} onChange={onCurrency} disabled={running} />
        </div>

        <dl className="mt-3 px-0.5">
          <SummaryRow label="You pay" strong>
            {preview.state === "ok" && preview.total !== undefined ? `${formatAmount(preview.total, 6)} ${asset}` : preview.state === "loading" ? <Shimmer w="w-24" /> : "—"}
          </SummaryRow>
          <SummaryRow label={<>KwesPay fee{feePct !== undefined && <span className="text-faint"> · {feePct.toFixed(feePct < 1 ? 1 : 0)}%</span>}</>}>
            {preview.state === "ok" && preview.fee !== undefined ? `${formatAmount(preview.fee, 6)} ${asset}` : preview.state === "loading" ? <Shimmer w="w-16" /> : "—"}
          </SummaryRow>
          <SummaryRow label="Network fee">
            <span className="font-sans text-muted">Paid in {network.native.symbol}</span>
          </SummaryRow>
        </dl>
      </div>

      <div className="mt-5 border-t border-hairline pt-4">
        {!running && readiness && <ReadinessArea readiness={readiness} />}
        {running && (
          <div className="flex h-9 items-center gap-2.5 text-[13px] text-text-2">
            <Spinner className="text-brand" />
            Payment in progress
          </div>
        )}
        {error && <p className="mt-2 text-[12.5px] text-error">{error}</p>}
      </div>

      <div className="sticky bottom-0 z-10 -mx-5 mt-3 border-t border-hairline bg-surface/95 px-5 py-3 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button variant="primary" size="lg" disabled={!ready || running || !validAmount} loading={running} onClick={onPay} className="w-full text-[14px] font-semibold tracking-[-0.005em]">
          {running ? "Processing payment" : validAmount ? `Send ${formatFiat(value, currency)} ${asset}` : "Enter an amount"}
          {!running && ready && validAmount && <Icon name="arrow-right" className="size-3.5 opacity-80" />}
        </Button>
      </div>
    </div>
  );
}
