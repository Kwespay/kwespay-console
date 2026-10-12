"use client";

import { useState } from "react";

function JsonNode({ name, value, depth, last }: { name?: string; value: unknown; depth: number; last: boolean }) {
  const [open, setOpen] = useState(depth < 2);
  const isObj = value !== null && typeof value === "object";
  const key =
    name !== undefined ? (
      <>
        <span className="text-code-key">&quot;{name}&quot;</span>
        <span className="text-muted">: </span>
      </>
    ) : null;
  const comma = last ? "" : ",";
  if (!isObj) {
    const cls = typeof value === "string" ? "text-code-string" : typeof value === "number" || typeof value === "bigint" ? "text-code-number" : "text-code";
    const text = typeof value === "string" ? `"${value}"` : String(value);
    return (
      <div className="break-all whitespace-pre-wrap" style={{ paddingLeft: depth * 14 }}>
        {key}
        <span className={cls}>{text}</span>
        <span className="text-muted">{comma}</span>
      </div>
    );
  }
  const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
  const [o, c] = Array.isArray(value) ? ["[", "]"] : ["{", "}"];
  return (
    <div>
      <div className="whitespace-nowrap" style={{ paddingLeft: depth * 14 }}>
        <button type="button" onClick={() => setOpen(!open)} className="mr-1 w-3 text-faint transition-colors duration-150 hover:text-text" aria-label={open ? "Collapse" : "Expand"}>
          {open ? "▾" : "▸"}
        </button>
        {key}
        <span className="text-muted">{o}</span>
        {!open && (
          <span className="text-faint">
            {" "}
            {entries.length} {Array.isArray(value) ? "items" : "keys"} {c}
            {comma}
          </span>
        )}
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode key={k} name={Array.isArray(value) ? undefined : k} value={v} depth={depth + 1} last={i === entries.length - 1} />
          ))}
          <div style={{ paddingLeft: depth * 14 + 16 }} className="text-muted">
            {c}
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

export function JsonViewer({ value }: { value: unknown }) {
  return (
    <div className="kp-scroll max-h-[420px] min-w-0 overflow-auto rounded-[var(--radius-sm)] border border-border bg-inset px-4 py-3 font-mono text-[11.5px] leading-[1.7]">
      <JsonNode value={value} depth={0} last />
    </div>
  );
}

export function toPlain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null, (_k, v) => (typeof v === "bigint" ? v.toString() : v)));
}
