"use client";

import { useEffect, useState } from "react";
import type { Run } from "@/src/sdk/run";
import { networkByKey } from "@/src/networks";
import { ChainLogo, Icon, StatusDot, TokenLogo, cx, formatFiat } from "./ui";

function ago(ts: number, now: number): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function RecentPayments({ runs, current, disabled, onSelect }: { runs: Run[]; current?: string; disabled?: boolean; onSelect: (r: Run) => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const list = runs.filter((r) => r.id !== current).slice(0, 4);
  if (list.length === 0) return null;
  return (
    <section className="mt-auto pt-8">
      <div className="mb-1.5 flex items-baseline justify-between">
        <h2 className="text-[12px] font-medium text-text-2">Recent</h2>
        <span className="text-[11px] text-faint">This session</span>
      </div>
      <ul className="-mx-2">
        {list.map((r) => {
          const ok = r.phase === "completed";
          const failed = r.phase === "failed";
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(r)}
                className={cx("group flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-[7px] text-left transition-colors duration-150 hover:bg-hover disabled:opacity-60 disabled:hover:bg-transparent")}
              >
                <StatusDot tone={ok ? "ok" : failed ? "error" : "warn"} />
                <span className="text-[13px] text-text tnum">{formatFiat(r.fiatAmount, r.fiatCurrency)}</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11.5px] text-text-2">
                  <TokenLogo symbol={r.asset} size={13} />
                  {r.asset}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1 text-[12.5px] text-muted">
                  <ChainLogo network={r.network} size={12} />
                  <span className="truncate">{networkByKey(r.network).name}</span>
                </span>
                <span className="ml-auto shrink-0 text-[11.5px] text-faint tnum">{ok ? ago(r.startedAt, now) : failed ? "Failed" : "Interrupted"}</span>
                <Icon name="chevron-right" className="size-3 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
