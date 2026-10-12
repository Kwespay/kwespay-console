"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ECOSYSTEM_NAME, TESTNET_NETWORKS, networkByKey, type Ecosystem } from "@/src/networks";
import { ChainLogo, Icon, cx } from "./ui";

const GROUPS: { eco: Ecosystem; label: string }[] = [
  { eco: "evm", label: "EVM" },
  { eco: "sui", label: "Sui" },
  { eco: "stellar", label: "Stellar" },
];

export function NetworkPicker({ selected, enabled, locked, onSelect }: { selected: string; enabled?: string[]; locked: boolean; onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const current = networkByKey(selected);

  const ordered = useMemo(() => GROUPS.flatMap((g) => TESTNET_NETWORKS.filter((n) => n.ecosystem === g.eco)), []);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, ordered.findIndex((n) => n.key === selected)));
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    setTimeout(() => listRef.current?.focus(), 0);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open, ordered, selected]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (key: string) => {
    onSelect(key);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % ordered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + ordered.length) % ordered.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(ordered.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(ordered[active].key);
    } else if (e.key === "Escape" || e.key === "Tab") {
      if (e.key === "Escape") e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={locked}
        title={locked ? "Wait for the current payment to finish" : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "group flex h-10 min-w-[220px] items-center gap-3 rounded-[var(--radius-sm)] py-1 pr-2.5 pl-3 text-left ring-1 ring-inset transition-[background-color,box-shadow] duration-150 ease-out disabled:opacity-60",
          open ? "bg-surface ring-border-strong" : "bg-surface ring-border hover:ring-border-strong",
        )}
      >
        <ChainLogo network={current.key} size={20} />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium text-text">{current.name}</span>
          <span className="text-[11px] text-muted">{ECOSYSTEM_NAME[current.ecosystem]} · Testnet</span>
        </span>
        <Icon name="chevron-down" className={cx("size-3.5 text-muted transition-transform duration-150 ease-out", open && "rotate-180")} />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Network"
          aria-activedescendant={`${listId}-${active}`}
          onKeyDown={onKey}
          className="kp-scroll absolute top-[calc(100%+6px)] left-0 z-40 max-h-[min(440px,70vh)] w-[280px] origin-top-left animate-kp-pop overflow-auto rounded-[var(--radius-md)] border border-border bg-surface p-1 shadow-pop outline-none"
        >
          <div className="px-2.5 pt-2 pb-1.5 text-[12px] font-medium text-text">Networks</div>
          {GROUPS.map((g, gi) => {
            const items = TESTNET_NETWORKS.filter((n) => n.ecosystem === g.eco);
            return (
              <div key={g.eco} role="group" aria-label={g.label} className={cx("mt-1 pt-1", gi > 0 && "border-t border-hairline")}>
                <div className="kp-eyebrow px-2.5 pt-1.5 pb-1 text-[10px]">{g.label}</div>
                {items.map((n) => {
                  const index = ordered.indexOf(n);
                  const isSel = n.key === selected;
                  const off = enabled !== undefined && !enabled.includes(n.key);
                  return (
                    <div
                      key={n.key}
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isSel}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(n.key)}
                      className={cx("flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-[7px] transition-colors duration-100", index === active && "bg-hover")}
                    >
                      <ChainLogo network={n.key} size={16} className={cx(off && "opacity-50")} />
                      <span className={cx("flex-1 truncate text-[13px]", isSel ? "font-medium text-text" : off ? "text-faint" : "text-text-2")}>{n.name}</span>
                      {off && <span className="text-[11px] text-faint">Not enabled</span>}
                      {isSel && <Icon name="check" className="size-3.5 text-brand" strokeWidth={1.75} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="mt-1 flex items-center gap-2 border-t border-hairline px-2.5 pt-2 pb-1.5 text-[11px] text-faint">
            <span>↑↓ to move</span>
            <span>·</span>
            <span>↵ to select</span>
            <span>·</span>
            <span>esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
