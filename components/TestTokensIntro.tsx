"use client";

import { useEffect, useId, useState } from "react";
import type { ConsoleNetwork } from "@/src/networks";
import { Button, ChainLogo, Icon, TokenLogo } from "./ui";

function listOf(items: string[]): string {
  try {
    return new Intl.ListFormat("en", { style: "long", type: "conjunction" }).format(items);
  } catch {
    return items.join(", ");
  }
}

export function TestTokensIntro({ open, network, onGet, onDismiss }: { open: boolean; network: ConsoleNetwork; onGet: () => void; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 650);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onDismiss();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, onDismiss]);

  if (!visible) return null;

  const native = network.native.symbol;
  const payWith = Array.from(new Set(network.tokens.map((t) => t.symbol)));
  const shelf = [native, ...payWith].slice(0, 5);

  return (
    <div role="dialog" aria-labelledby={titleId} className="absolute top-[calc(100%+12px)] right-0 z-40 w-[min(360px,calc(100vw-32px))] origin-top-right animate-kp-coach">
      <span aria-hidden className="absolute -top-[6px] right-[46px] size-3 rotate-45 border-t border-l border-border bg-surface-2" />
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-modal">
        <div className="kp-stage relative flex h-[112px] items-center justify-center border-b border-hairline bg-surface-2">
          <div className="relative flex items-end gap-5">
            {shelf.map((symbol, i) => (
              <div key={`${network.key}-${symbol}`} className="flex flex-col items-center gap-2" style={{ animation: `kp-token-rise 480ms var(--ease-out) ${120 + i * 70}ms both, kp-float 3.8s ease-in-out ${600 + i * 70}ms infinite` }}>
                <TokenLogo symbol={symbol} size={i === 0 ? 34 : 30} className="drop-shadow-[0_6px_10px_rgba(15,18,24,0.18)]" />
                <span className="font-mono text-[10.5px] text-muted">{symbol}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4 pb-5">
          <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
            <ChainLogo network={network.key} size={13} />
            {network.name}
          </p>
          <h2 id={titleId} className="mt-1.5 text-[15.5px] font-semibold tracking-[-0.015em] text-text">
            Fund your test wallet first
          </h2>
          <p className="mt-1.5 text-[13px] leading-[1.55] text-text-2">
            Every payment in the console runs on testnet. Get {native} for network fees{payWith.length ? <>, plus {listOf(payWith)} to pay with</> : null}. They&rsquo;re free and have no real value.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <Button variant="primary" size="md" onClick={onGet} className="flex-1 sm:flex-none">
              Get test tokens
              <Icon name="arrow-right" className="size-3.5" />
            </Button>
            <Button variant="ghost" size="md" onClick={onDismiss}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
