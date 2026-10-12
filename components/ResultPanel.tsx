"use client";

import type { ReactNode } from "react";
import type { ConsoleNetwork } from "@/src/networks";
import type { FriendlyError } from "@/src/sdk/errors";
import type { Phase, Run } from "@/src/sdk/run";
import { RecentPayments } from "./RecentPayments";
import { Button, ChainLogo, CopyButton, Icon, LinkButton, Mono, StatusDot, TokenLogo, cx, formatAmount, formatFiat, formatMs, shortAddress } from "./ui";

const TRAIL: { phase: Phase; done: string; active: string; waiting: string; step?: string }[] = [
  { phase: "preparing", done: "Quote created", active: "Creating quote", waiting: "Create quote", step: "quote" },
  { phase: "wallet", done: "Approved in wallet", active: "Waiting for wallet approval", waiting: "Wallet approval" },
  { phase: "submitted", done: "Transaction broadcast", active: "Broadcasting transaction", waiting: "Broadcast transaction", step: "pay" },
  { phase: "confirming", done: "Confirmed by KwesPay", active: "Confirming transaction", waiting: "Confirm transaction", step: "poll" },
];

const HEADLINE: Partial<Record<Phase, string>> = {
  preparing: "Preparing payment",
  wallet: "Processing payment",
  submitted: "Payment submitted",
  confirming: "Confirming payment",
};

function PaneHeader({ status }: { status?: ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-between border-b border-hairline px-5 sm:px-7">
      <span className="text-[12px] font-medium text-text-2">Live result</span>
      {status}
    </div>
  );
}

function Chip({ tone, children, pulse }: { tone: "ok" | "warn" | "error" | "idle" | "brand"; children: ReactNode; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <StatusDot tone={tone} pulse={pulse} />
      {children}
    </span>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 py-2.5">
      <dt className="text-[12.5px] text-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[13px] text-text">{children}</dd>
    </div>
  );
}

function Trail({ run }: { run: Run }) {
  const order = TRAIL.findIndex((t) => t.phase === run.phase);
  return (
    <ol className="relative">
      {TRAIL.map((t, i) => {
        const state = i < order ? "done" : i === order ? "active" : "waiting";
        const ms = t.step ? run.steps.find((s) => s.id === t.step)?.ms : undefined;
        return (
          <li key={t.phase} className="relative grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-3 py-[7px]">
            {i < TRAIL.length - 1 && <span aria-hidden className={cx("absolute top-[22px] bottom-[-8px] left-[9.5px] w-px transition-colors duration-200", i < order ? "bg-ok/40" : "bg-border")} />}
            <span className="relative z-[1] flex size-5 items-center justify-center bg-surface-2">
              {state === "done" ? (
                <Icon name="check" strokeWidth={2} className="size-3.5 text-ok" />
              ) : state === "active" ? (
                <span className="size-2 animate-kp-pulse rounded-full bg-brand text-brand" />
              ) : (
                <span className="size-2 rounded-full border border-border-strong" />
              )}
            </span>
            <span className={cx("text-[13px] transition-colors duration-150", state === "done" ? "text-text-2" : state === "active" ? "font-medium text-text" : "text-faint")}>{t[state]}</span>
            <span className="font-mono text-[11.5px] text-faint tnum">{state === "done" ? formatMs(ms) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ResultPanel({
  run,
  runs,
  network,
  decimals,
  error,
  backendMatched,
  onAction,
  onExport,
  onDetails,
  onSelectRun,
}: {
  run?: Run;
  runs: Run[];
  network: ConsoleNetwork;
  decimals: number;
  error?: FriendlyError;
  backendMatched: boolean;
  onAction: (kind: string) => void;
  onExport: () => void;
  onDetails: () => void;
  onSelectRun: (r: Run) => void;
}) {
  const running = Boolean(run && run.phase !== "completed" && run.phase !== "failed");
  const total = run?.payload ? Number(run.payload.totalBaseUnits) / 10 ** decimals : undefined;
  const status = !run ? (
    <Chip tone="idle">Idle</Chip>
  ) : running ? (
    <Chip tone="brand" pulse>
      Live
    </Chip>
  ) : run.phase === "completed" ? (
    <Chip tone="ok">Complete</Chip>
  ) : (
    <Chip tone="error">Failed</Chip>
  );

  return (
    <div className="flex h-full flex-col">
      <PaneHeader status={status} />

      <div className="flex flex-1 flex-col px-5 py-6 sm:px-7" aria-live="polite">
        {!run && (
          <div key="empty" className="flex flex-1 animate-kp-in flex-col items-start justify-center py-10 lg:py-0 lg:pb-20">
            <svg viewBox="0 0 24 24" aria-hidden className="mb-4 size-6 text-faint">
              <circle cx="12" cy="12" r="9.25" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2.5 2.5" />
            </svg>
            <div className="text-[15px] font-medium tracking-[-0.01em] text-text">No payment yet</div>
            <p className="mt-1.5 max-w-[300px] text-[13px] leading-[1.55] text-muted">Choose an amount and send a test payment. Your transaction progress will appear here.</p>
          </div>
        )}

        {run && running && (
          <div key="running" className="animate-kp-in">
            <div className="text-[15px] font-semibold tracking-[-0.01em] text-text">{HEADLINE[run.phase] ?? "Processing payment"}</div>
            <p className="mt-1 text-[13px] text-muted">{run.phaseText}</p>

            <dl className="mt-5 grid grid-cols-3 divide-x divide-hairline rounded-[var(--radius-md)] border border-border bg-surface">
              {(
                [
                  ["Amount", formatFiat(run.fiatAmount, run.fiatCurrency), null],
                  ["Asset", total !== undefined ? `${formatAmount(total, 6)} ${run.asset}` : run.asset, <TokenLogo key="t" symbol={run.asset} size={14} />],
                  ["Network", network.name, <ChainLogo key="c" network={network.key} size={14} />],
                ] as const
              ).map(([k, v, logo]) => (
                <div key={k} className="min-w-0 px-3.5 py-3">
                  <dt className="text-[11.5px] text-muted">{k}</dt>
                  <dd className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] font-medium text-text tnum">
                    {logo}
                    <span className="truncate">{v}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-6">
              <Trail run={run} />
            </div>
          </div>
        )}

        {run?.phase === "completed" && (
          <div key="done" className="animate-kp-in">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ok">
              <Icon name="check" strokeWidth={2} className="size-3.5" />
              Payment complete
            </div>
            <div className="mt-3 text-[32px] leading-none font-semibold tracking-[-0.03em] text-text tnum">{formatFiat(run.fiatAmount, run.fiatCurrency)}</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <TokenLogo symbol={run.asset} size={14} />
                {total !== undefined ? <span className="font-mono text-[12.5px] text-text-2 tnum">{formatAmount(total, 6)} {run.asset}</span> : run.asset}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ChainLogo network={network.key} size={14} />
                {network.name}
              </span>
            </div>

            <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
              {run.txHash && (
                <Detail label="Transaction">
                  <Mono className="truncate" title={run.txHash}>
                    {shortAddress(run.txHash, 6, 4)}
                  </Mono>
                  <CopyButton value={run.txHash} />
                </Detail>
              )}
              <Detail label="Backend match">
                {backendMatched ? (
                  <span className="inline-flex items-center gap-1.5 text-ok">
                    <Icon name="check" strokeWidth={2} className="size-3.5" />
                    Confirmed
                  </span>
                ) : (
                  <button type="button" onClick={onDetails} className="inline-flex items-center gap-1.5 text-warn hover:underline">
                    <Icon name="alert" className="size-3.5" />
                    Partial match
                  </button>
                )}
              </Detail>
              {run.payload?.transactionReference && (
                <Detail label="Reference">
                  <Mono className="truncate text-text-2">{run.payload.transactionReference}</Mono>
                </Detail>
              )}
            </dl>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {run.txHash && (
                <LinkButton href={`${network.explorerTx}${run.txHash}`} variant="secondary" size="sm">
                  View transaction
                  <Icon name="external" className="size-3.5 text-muted" />
                </LinkButton>
              )}
              <Button size="sm" onClick={onExport}>
                Export evidence
              </Button>
              <Button variant="ghost" size="sm" onClick={onDetails} className="ml-auto">
                Inspect
                <Icon name="chevron-right" className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {run?.phase === "failed" && error && (
          <div key="failed" className="animate-kp-in">
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-error">
              <Icon name="x" strokeWidth={2} className="size-3.5" />
              {run.submitted ? "Payment failed" : "Payment not sent"}
            </div>
            <div className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-text">{error.title}</div>
            <p className="mt-1.5 text-[13px] leading-[1.55] text-text-2">{error.message}</p>
            <p className="mt-1 text-[13px] text-muted">{error.funds}</p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {error.action && (
                <Button size="sm" variant="primary" onClick={() => onAction(error.action!.kind)}>
                  {error.action.label}
                </Button>
              )}
              {run.txHash && (
                <LinkButton href={`${network.explorerTx}${run.txHash}`} size="sm">
                  View on explorer
                  <Icon name="external" className="size-3.5 text-muted" />
                </LinkButton>
              )}
              <Button variant="ghost" size="sm" onClick={onDetails} className="ml-auto">
                Inspect
                <Icon name="chevron-right" className="size-3.5" />
              </Button>
            </div>

            <dl className="mt-6 border-t border-hairline">
              <Detail label="Error code">
                <Mono className="text-error">{error.code}</Mono>
              </Detail>
            </dl>
          </div>
        )}

        <RecentPayments runs={runs} current={run?.id} disabled={running} onSelect={onSelectRun} />
      </div>
    </div>
  );
}
