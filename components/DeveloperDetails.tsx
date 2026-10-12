"use client";

import { useState } from "react";
import type { Run, Step } from "@/src/sdk/run";
import { highlight, type Token } from "@/src/sdk/snippet";
import { JsonViewer, toPlain } from "./JsonViewer";
import { CopyButton, Icon, cx, formatMs } from "./ui";

export type DetailsTab = "code" | "activity" | "request" | "response" | "error" | "evidence" | "chain" | "logs";

export interface EvidenceRow {
  field: string;
  sdk: string;
  backend: string;
  result: "match" | "mismatch" | "na" | "pending";
}

function Marker({ state }: { state: Step["state"] }) {
  if (state === "ok") return <Icon name="check" strokeWidth={2} className="size-3.5 text-ok" />;
  if (state === "failed") return <Icon name="x" strokeWidth={2} className="size-3.5 text-error" />;
  if (state === "running") return <span className="size-2 animate-kp-pulse rounded-full bg-brand text-brand" />;
  if (state === "skipped") return <span className="h-px w-2.5 bg-faint" />;
  return <span className="size-2 rounded-full border border-border-strong" />;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-[13px] text-muted">{children}</p>;
}

const TOKEN_CLASS: Record<Token["kind"], string> = {
  keyword: "text-code-key",
  string: "text-code-string",
  number: "text-code-number",
  key: "text-text-2",
  fn: "text-code",
  punct: "text-muted",
  plain: "text-text",
};

const FLOW = [
  { call: "quote()", what: "KwesPay prices the payment in your currency and signs the terms." },
  { call: "pay()", what: "The customer's wallet submits it. Network switching, approvals and Sui or Stellar signing are handled for you." },
  { call: "pollTransactionStatus()", what: "Resolves once KwesPay has confirmed the payment on-chain." },
];

function CodeView({ code }: { code: string }) {
  const lines = code.split("\n");
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 overflow-hidden rounded-[var(--radius-sm)] border border-border bg-inset">
        <div className="flex h-9 items-center gap-3 border-b border-hairline px-4">
          <span className="font-mono text-[11.5px] text-muted">checkout.ts</span>
          <span className="text-[11px] text-faint">{lines.filter((l) => l.trim()).length} lines</span>
          <span className="ml-auto">
            <CopyButton value={code} label="Copy" />
          </span>
        </div>
        <pre className="kp-scroll overflow-x-auto py-3 font-mono text-[12px] leading-[1.75]">
          <code>
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-[36px_minmax(0,1fr)] pr-4">
                <span className="pr-3 text-right text-faint select-none tnum">{i + 1}</span>
                <span className="whitespace-pre">
                  {highlight(line).map((t, j) => (
                    <span key={j} className={TOKEN_CLASS[t.kind]}>
                      {t.text}
                    </span>
                  ))}
                  {line === "" && " "}
                </span>
              </div>
            ))}
          </code>
        </pre>
      </div>

      <aside className="space-y-4">
        <div>
          <div className="mb-1.5 text-[11.5px] font-medium text-muted">Install</div>
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-border bg-surface py-1.5 pr-1.5 pl-3">
            <code className="truncate font-mono text-[12px] text-text">npm i @kwespay/client</code>
            <CopyButton value="npm install @kwespay/client" />
          </div>
        </div>
        <ol className="space-y-3">
          {FLOW.map((f, i) => (
            <li key={f.call} className="grid grid-cols-[18px_minmax(0,1fr)] gap-2">
              <span className="font-mono text-[11px] leading-5 text-faint tnum">{i + 1}</span>
              <span>
                <span className="block font-mono text-[12px] leading-5 text-text">{f.call}</span>
                <span className="block text-[12px] leading-[1.5] text-muted">{f.what}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="border-t border-hairline pt-3 text-[11.5px] leading-[1.5] text-faint">Updates live with the network, token, amount and currency you pick. It&apos;s the same flow this console runs when you press Send.</p>
      </aside>
    </div>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 flex min-h-8 items-center gap-3 text-[12.5px]">{children}</div>;
}

export function DeveloperDetails({
  open,
  onToggle,
  tab,
  onTab,
  steps,
  run,
  evidence,
  chain,
  code,
  onDownloadEvidence,
}: {
  open: boolean;
  onToggle: () => void;
  tab: DetailsTab;
  onTab: (t: DetailsTab) => void;
  steps: Step[];
  run?: Run;
  evidence: EvidenceRow[];
  chain: Record<string, unknown>;
  code: string;
  onDownloadEvidence: () => void;
}) {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const done = steps.filter((s) => s.state === "ok").length;
  const failed = steps.find((s) => s.state === "failed");
  const runningStep = steps.find((s) => s.state === "running");
  const step = steps.find((s) => s.id === selected) ?? failed ?? [...steps].reverse().find((s) => s.state !== "waiting" && s.state !== "skipped") ?? steps[0];
  const logs = run?.logs ?? [];
  const jsonl = logs.map((l) => JSON.stringify({ ts: l.ts, network: l.network, step: l.step, ok: l.ok, ms: l.ms, detail: l.detail })).join("\n");
  const checked = evidence.filter((e) => e.result !== "na");
  const matched = evidence.filter((e) => e.result === "match").length;

  const tabs: { id: DetailsTab; label: string; count?: number; alert?: boolean }[] = [
    { id: "code", label: "Code" },
    { id: "activity", label: "Activity", count: steps.length || undefined },
    { id: "request", label: "Request" },
    { id: "response", label: "Response" },
    { id: "error", label: "Error", alert: Boolean(failed) },
    { id: "evidence", label: "Evidence", count: checked.length || undefined },
    { id: "chain", label: "Chain" },
    { id: "logs", label: "Logs", count: logs.length || undefined },
  ];

  const summary = steps.length === 0 ? "Integration code, SDK activity, payloads, logs and evidence" : `${done} of ${steps.length} SDK calls complete${runningStep ? ` · ${runningStep.method} running` : ""}${failed ? ` · ${failed.method} failed` : ""}`;

  return (
    <section id="developer-details" className="border-t border-border">
      <button type="button" onClick={onToggle} aria-expanded={open} className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-hover/60 sm:px-7">
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tracking-[-0.005em] text-text">Developer details</span>
          <span className={cx("block truncate text-[12px]", failed ? "text-error" : "text-muted")}>{summary}</span>
        </span>
        {steps.length > 0 && (
          <span aria-hidden className="hidden items-center gap-[3px] sm:flex">
            {steps.map((s) => (
              <span key={s.id} className={cx("h-1 w-3.5 rounded-full transition-colors duration-200", s.state === "ok" ? "bg-ok/70" : s.state === "failed" ? "bg-error" : s.state === "running" ? "bg-brand" : "bg-border-strong")} />
            ))}
          </span>
        )}
        <Icon name="chevron-down" className={cx("size-3.5 text-muted transition-transform duration-180 ease-out group-hover:text-text", open && "rotate-180")} />
      </button>

      <div className="kp-collapse" data-open={open}>
        <div>
          <div className="border-t border-hairline bg-surface-2">
            <div role="tablist" aria-label="Developer details" className="flex gap-1 overflow-x-auto border-b border-hairline px-4 [scrollbar-width:none] sm:px-6">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.id}
                  tabIndex={open ? 0 : -1}
                  onClick={() => onTab(t.id)}
                  className={cx(
                    "relative flex h-10 shrink-0 items-center gap-1.5 px-2.5 text-[12.5px] transition-colors duration-150",
                    tab === t.id ? "font-medium text-text" : "text-muted hover:text-text",
                  )}
                >
                  {t.label}
                  {t.count !== undefined && <span className="font-mono text-[10.5px] text-faint tnum">{t.count}</span>}
                  {t.alert && <span className="size-1.5 rounded-full bg-error" />}
                  <span className={cx("absolute inset-x-2.5 -bottom-px h-[1.5px] rounded-full transition-colors duration-150", tab === t.id ? "bg-text" : "bg-transparent")} />
                </button>
              ))}
            </div>

            <div className="px-5 py-5 sm:px-7">
              {tab === "code" && <CodeView code={code} />}

              {tab === "activity" &&
                (steps.length === 0 ? (
                  <Empty>Connect your KwesPay account to see SDK calls here.</Empty>
                ) : (
                  <ol className="-mx-2 max-w-[760px]">
                    {steps.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(s.id);
                            onTab(s.state === "failed" ? "error" : s.response ? "response" : "request");
                          }}
                          className="group grid w-full grid-cols-[16px_minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--radius-sm)] px-2 py-2 text-left transition-colors duration-150 hover:bg-hover"
                        >
                          <span className="flex h-5 items-center justify-center">
                            <Marker state={s.state} />
                          </span>
                          <span className="min-w-0">
                            <span className={cx("block text-[13px]", s.state === "waiting" || s.state === "skipped" ? "text-faint" : "text-text")}>{s.label}</span>
                            <span className="block font-mono text-[11.5px] text-muted">{s.method}</span>
                            {s.state === "running" && run?.phaseText && <span className="mt-0.5 block text-[12px] text-text-2">{run.phaseText}</span>}
                            {s.state === "failed" && s.error && <span className="mt-0.5 block truncate font-mono text-[11.5px] text-error">{s.error.code}</span>}
                          </span>
                          <span className="flex h-5 items-center gap-2 font-mono text-[11.5px] text-muted tnum">
                            {formatMs(s.ms)}
                            <Icon name="chevron-right" className="size-3 text-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ))}

              {(tab === "request" || tab === "response" || tab === "error") &&
                (step ? (
                  <div>
                    <Toolbar>
                      <div className="flex flex-wrap gap-1">
                        {steps.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setSelected(s.id)}
                            className={cx(
                              "h-7 rounded-[var(--radius-xs)] px-2 font-mono text-[11.5px] transition-colors duration-150",
                              s.id === step.id ? "bg-surface text-text shadow-[0_0_0_1px_var(--kp-border-strong)]" : "text-muted hover:bg-hover hover:text-text",
                            )}
                          >
                            {s.method}
                          </button>
                        ))}
                      </div>
                      <span className="ml-auto">
                        <CopyButton value={JSON.stringify(toPlain(tab === "request" ? step.request : tab === "response" ? step.response : step.error), null, 2)} label="Copy JSON" />
                      </span>
                    </Toolbar>
                    {tab === "error" ? (
                      step.error ? (
                        <div className="rounded-[var(--radius-sm)] border border-error/20 bg-error-bg px-4 py-3">
                          <div className="font-mono text-[12.5px] font-medium text-error">{step.error.code}</div>
                          <div className="mt-1 font-mono text-[12px] leading-[1.6] break-all text-text-2">{step.error.message}</div>
                        </div>
                      ) : (
                        <Empty>No error for this step.</Empty>
                      )
                    ) : (tab === "request" ? step.request : step.response) !== undefined ? (
                      <JsonViewer value={toPlain(tab === "request" ? step.request : step.response)} />
                    ) : (
                      <Empty>Nothing yet. This step hasn&apos;t run.</Empty>
                    )}
                  </div>
                ) : (
                  <Empty>No SDK calls yet.</Empty>
                ))}

              {tab === "evidence" &&
                (evidence.length === 0 ? (
                  <Empty>Evidence appears after a payment finishes. It compares what the SDK returned with KwesPay&apos;s record.</Empty>
                ) : (
                  <div>
                    <Toolbar>
                      <span className={cx("inline-flex items-center gap-1.5", matched === checked.length ? "text-ok" : "text-warn")}>
                        <Icon name={matched === checked.length ? "check" : "alert"} strokeWidth={2} className="size-3.5" />
                        {matched} of {checked.length} checked fields match
                      </span>
                      <button type="button" onClick={onDownloadEvidence} className="ml-auto font-medium text-brand hover:text-brand-hover">
                        Download JSON
                      </button>
                    </Toolbar>
                    <div className="overflow-hidden rounded-[var(--radius-sm)] border border-border bg-surface">
                      <div className="hidden grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-4 border-b border-hairline bg-surface-3/50 px-4 py-2 text-[11px] font-medium text-muted sm:grid">
                        <span>Field</span>
                        <span>SDK</span>
                        <span>Backend</span>
                        <span className="text-right">Result</span>
                      </div>
                      <dl className="divide-y divide-hairline">
                        {evidence.map((e) => (
                          <div key={e.field} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[160px_minmax(0,1fr)_minmax(0,1fr)_44px] sm:gap-4">
                            <dt className="text-[12.5px] text-text-2">{e.field}</dt>
                            <dd className="min-w-0 font-mono text-[11.5px] leading-[1.6] break-all text-text">
                              <span className="font-sans text-faint sm:hidden">SDK · </span>
                              {e.sdk}
                            </dd>
                            <dd className={cx("min-w-0 font-mono text-[11.5px] leading-[1.6] break-all", e.result === "na" ? "font-sans text-faint" : "text-text")}>
                              <span className="font-sans text-faint sm:hidden">Backend · </span>
                              {e.backend}
                            </dd>
                            <dd className="flex sm:justify-end">
                              {e.result === "match" ? (
                                <Icon name="check" strokeWidth={2} className="size-3.5 text-ok" />
                              ) : e.result === "mismatch" ? (
                                <Icon name="x" strokeWidth={2} className="size-3.5 text-error" />
                              ) : (
                                <span className="text-[11px] text-faint">{e.result === "pending" ? "…" : "n/a"}</span>
                              )}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>
                ))}

              {tab === "chain" && (
                <div>
                  <Toolbar>
                    <span className="text-muted">Network and payload values used for this payment</span>
                    <span className="ml-auto">
                      <CopyButton value={JSON.stringify(toPlain(chain), null, 2)} label="Copy JSON" />
                    </span>
                  </Toolbar>
                  <JsonViewer value={toPlain(chain)} />
                </div>
              )}

              {tab === "logs" &&
                (logs.length === 0 ? (
                  <Empty>Structured logs appear while a payment runs.</Empty>
                ) : (
                  <div>
                    <Toolbar>
                      <span className="text-muted">{logs.length} entries</span>
                      <span className="ml-auto">
                        <CopyButton value={jsonl} label="Copy JSONL" />
                      </span>
                    </Toolbar>
                    <div className="kp-scroll max-h-[340px] overflow-auto rounded-[var(--radius-sm)] border border-border bg-inset py-2 font-mono text-[11.5px] leading-[1.8]">
                      {logs.map((l, i) => (
                        <div key={i} className="grid min-w-[680px] grid-cols-[96px_112px_180px_36px_56px_minmax(0,1fr)] gap-3 px-4 hover:bg-hover">
                          <span className="text-faint tnum">{l.ts}</span>
                          <span className="text-muted">{l.network}</span>
                          <span className="truncate text-text">{l.step}</span>
                          <span className={l.ok === true ? "text-ok" : l.ok === false ? "text-error" : "text-faint"}>{l.ok === true ? "ok" : l.ok === false ? "fail" : "·"}</span>
                          <span className="text-right text-muted tnum">{l.ms !== undefined ? `${l.ms}ms` : ""}</span>
                          <span className="truncate text-text-2" title={l.detail}>
                            {l.detail}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
