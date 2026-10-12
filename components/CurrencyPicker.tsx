"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ALL_CURRENCIES, FEATURED_CURRENCIES, currencyName } from "@/src/currencies";
import { Icon, cx } from "./ui";

export function CurrencyPicker({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (c: string) => !q || c.toLowerCase().includes(q) || currencyName(c).toLowerCase().includes(q);
    if (q) return [{ label: "Results", items: ALL_CURRENCIES.filter(match) }];
    return [
      { label: "Featured", items: FEATURED_CURRENCIES },
      { label: "All currencies", items: ALL_CURRENCIES.filter((c) => !FEATURED_CURRENCIES.includes(c)) },
    ];
  }, [query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    setActive(query ? 0 : Math.max(0, flat.indexOf(value)));
  }, [query, open, flat, value]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (code: string) => {
    onChange(code);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (flat[active]) choose(flat[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    }
  };

  let index = -1;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Currency: ${currencyName(value)}`}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          "flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] pr-1.5 pl-2.5 font-mono text-[12px] font-medium text-text transition-[background-color,box-shadow] duration-150",
          open ? "bg-surface shadow-[0_0_0_1px_var(--kp-border-strong)]" : "bg-surface shadow-[0_0_0_1px_var(--kp-border)] hover:shadow-[0_0_0_1px_var(--kp-border-strong)]",
        )}
      >
        {value}
        <Icon name="chevron-down" className={cx("size-3 text-muted transition-transform duration-150", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 bottom-[calc(100%+8px)] z-40 w-[280px] origin-bottom-right animate-kp-pop overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface shadow-pop">
          <div className="flex items-center gap-2 border-b border-hairline px-3">
            <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="4.25" />
              <path d="M10.25 10.25L13 13" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKey}
              placeholder="Search currency"
              role="combobox"
              aria-controls={listId}
              aria-expanded
              aria-activedescendant={flat[active] ? `${listId}-${flat[active]}` : undefined}
              className="h-10 min-w-0 flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-faint"
            />
          </div>
          <div ref={listRef} id={listId} role="listbox" aria-label="Currency" className="kp-scroll max-h-[260px] overflow-auto p-1">
            {flat.length === 0 && <div className="px-2.5 py-6 text-center text-[12.5px] text-muted">No currency matches “{query}”</div>}
            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <div key={g.label} role="group" aria-label={g.label}>
                    <div className="kp-eyebrow px-2.5 pt-2 pb-1 text-[10px]">{g.label}</div>
                    {g.items.map((c) => {
                      index += 1;
                      const i = index;
                      return (
                        <div
                          key={c}
                          id={`${listId}-${c}`}
                          data-index={i}
                          role="option"
                          aria-selected={c === value}
                          onMouseEnter={() => setActive(i)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => choose(c)}
                          className={cx("flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-[6px] transition-colors duration-100", i === active && "bg-hover")}
                        >
                          <span className={cx("w-9 font-mono text-[12px]", c === value ? "font-medium text-text" : "text-text-2")}>{c}</span>
                          <span className="flex-1 truncate text-[12.5px] text-muted">{currencyName(c)}</span>
                          {c === value && <Icon name="check" className="size-3.5 text-brand" strokeWidth={1.75} />}
                        </div>
                      );
                    })}
                  </div>
                ),
            )}
          </div>
          <div className="border-t border-hairline px-3 py-2 text-[11px] text-faint">Converted at live FX rates by KwesPay</div>
        </div>
      )}
    </div>
  );
}
