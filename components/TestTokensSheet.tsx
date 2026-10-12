"use client";

import { useState } from "react";
import { Button, Icon, Modal, TokenLogo, formatAmount } from "./ui";

export interface TokenItem {
  id: string;
  title: string;
  why: string;
  balance?: number;
  symbol: string;
  source: string;
  action?: { label: string; run: () => Promise<string | void> };
  external?: { url: string; label: string; note: string; copy?: string };
  unavailable?: string;
}

export function TestTokensSheet({ open, onClose, networkName, items, explorerTx, onDone }: { open: boolean; onClose: () => void; networkName: string; items: TokenItem[]; explorerTx: string; onDone: () => void }) {
  const [busy, setBusy] = useState<string | undefined>(undefined);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string; tx?: string }>>({});

  return (
    <Modal open={open} onClose={onClose} title="Test tokens" description={`Free tokens with no real value, for ${networkName}.`} width={520}>
      <div className="divide-y divide-hairline overflow-hidden rounded-[var(--radius-md)] border border-border">
        {items.map((it) => {
          const r = results[it.id];
          return (
            <div key={it.id} className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <TokenLogo symbol={it.symbol} size={20} className="mt-px" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-medium text-text">{it.symbol}</span>
                    {it.balance !== undefined && <span className="font-mono text-[11.5px] text-muted tnum">{formatAmount(it.balance)}</span>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] leading-[1.5] text-muted">{it.unavailable ?? (it.external && !it.action ? it.external.note : it.why)}</p>
                  {it.source && !it.unavailable && <p className="mt-1 text-[11px] text-faint">{it.source}</p>}
                </div>
                {!it.unavailable && it.action && (
                  <Button
                    size="sm"
                    loading={busy === it.id}
                    disabled={busy !== undefined && busy !== it.id}
                    onClick={async () => {
                      setBusy(it.id);
                      try {
                        const tx = await it.action!.run();
                        setResults((s) => ({ ...s, [it.id]: { ok: true, text: "Done. Your balance will update in a moment.", tx: tx || undefined } }));
                        onDone();
                      } catch (e) {
                        const msg = String((e as Error)?.message ?? e);
                        setResults((s) => ({ ...s, [it.id]: { ok: false, text: /reject|denied|declin|cancel/i.test(msg) ? "You cancelled the request in your wallet." : msg.slice(0, 200) } }));
                      } finally {
                        setBusy(undefined);
                      }
                    }}
                  >
                    {it.action.label}
                  </Button>
                )}
                {!it.unavailable && !it.action && it.external && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (it.external!.copy) {
                        try {
                          await navigator.clipboard.writeText(it.external!.copy);
                        } catch {}
                      }
                      window.open(it.external!.url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    {it.external.label}
                    <Icon name="external" className="size-3.5 text-muted" />
                  </Button>
                )}
              </div>
              {r && (
                <p className={`mt-2 animate-kp-in text-[12.5px] ${r.ok ? "text-ok" : "text-error"}`}>
                  {r.text}{" "}
                  {r.tx && (
                    <a href={`${explorerTx}${r.tx}`} target="_blank" rel="noreferrer" className="font-medium text-brand hover:text-brand-hover">
                      View transaction
                    </a>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
