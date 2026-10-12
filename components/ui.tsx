"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { chainLogo, tokenLogo, type LogoAsset } from "@/src/logos";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function shortAddress(value: string, head = 6, tail = 4): string {
  if (!value) return "";
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatAmount(n: number, max = 4): string {
  if (!Number.isFinite(n)) return "—";
  const digits = n !== 0 && Math.abs(n) < 1 ? Math.min(6, max + 2) : max;
  return n.toLocaleString("en-US", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: digits });
}

export function formatFiat(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatMs(ms?: number): string {
  if (ms === undefined) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}

type IconName = "check" | "chevron-down" | "chevron-right" | "x" | "external" | "copy" | "sun" | "moon" | "monitor" | "arrow-right" | "alert" | "dot";

const PATHS: Record<IconName, ReactNode> = {
  check: <path d="M3.5 8.5l3 3 6-7" />,
  "chevron-down": <path d="M4.5 6.5l3.5 3.5 3.5-3.5" />,
  "chevron-right": <path d="M6.5 4.5l3.5 3.5-3.5 3.5" />,
  x: <path d="M4.5 4.5l7 7m0-7l-7 7" />,
  external: <path d="M6.5 4h-2A1.5 1.5 0 003 5.5v6A1.5 1.5 0 004.5 13h6a1.5 1.5 0 001.5-1.5v-2M9 3h4v4M13 3L7.5 8.5" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" />
      <path d="M10.5 3.5v-.25A1.25 1.25 0 009.25 2h-5A1.25 1.25 0 003 3.25v5A1.25 1.25 0 004.25 9.5h.25" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.75v1.5m0 9.5v1.5M1.75 8h1.5m9.5 0h1.5M3.6 3.6l1.05 1.05m6.7 6.7l1.05 1.05m0-8.8l-1.05 1.05m-6.7 6.7L3.6 12.4" />
    </>
  ),
  moon: <path d="M13.25 9.6A5.5 5.5 0 016.4 2.75a5.5 5.5 0 106.85 6.85z" />,
  monitor: (
    <>
      <rect x="2" y="3" width="12" height="8" rx="1.25" />
      <path d="M6 13.5h4" />
    </>
  ),
  "arrow-right": <path d="M3.5 8h9m-3.5-3.5L12.5 8 9 11.5" />,
  alert: (
    <>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3.25m0 2.25v.01" />
    </>
  ),
  dot: <circle cx="8" cy="8" r="2.5" fill="currentColor" stroke="none" />,
};

export function Icon({ name, className, strokeWidth = 1.5 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("size-4 shrink-0", className)}>
      {PATHS[name]}
    </svg>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "link";
type Size = "xs" | "sm" | "md" | "lg";

export function buttonClass(variant: Variant = "secondary", size: Size = "md", className?: string): string {
  const v = {
    primary:
      "bg-brand text-on-brand font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_1px_1px_rgba(15,18,24,0.08)] hover:bg-brand-hover active:bg-brand-press active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.22)] disabled:bg-surface-3 disabled:text-muted disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-border",
    secondary:
      "bg-surface text-text font-medium ring-1 ring-inset ring-border-strong hover:bg-hover active:bg-surface-3 disabled:text-faint disabled:ring-border",
    ghost: "text-text-2 font-medium hover:bg-hover hover:text-text active:bg-surface-3 disabled:text-faint",
    link: "text-brand font-medium hover:text-brand-hover underline-offset-2 hover:underline disabled:text-faint",
  }[variant];
  const s =
    variant === "link"
      ? "text-[13px]"
      : {
          xs: "h-7 px-2.5 text-[12px] rounded-[var(--radius-sm)]",
          sm: "h-8 px-3 text-[13px] rounded-[var(--radius-sm)]",
          md: "h-9 px-3.5 text-[13px] rounded-[var(--radius-sm)]",
          lg: "h-11 px-5 text-[14px] rounded-[var(--radius-md)]",
        }[size];
  return cx("inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 ease-out", v, s, className);
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button type="button" {...props} disabled={props.disabled || loading} className={buttonClass(variant, size, className)}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = "secondary", size = "md", className }: { href: string; children: ReactNode; variant?: Variant; size?: Size; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={buttonClass(variant, size, className)}>
      {children}
    </a>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={cx("size-3.5 shrink-0 animate-spin", className)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2" />
      <path d="M14 8a6 6 0 00-6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function StatusDot({ tone, pulse }: { tone: "ok" | "warn" | "error" | "idle" | "brand"; pulse?: boolean }) {
  const c = { ok: "bg-ok text-ok", warn: "bg-warn text-warn", error: "bg-error text-error", idle: "bg-faint text-faint", brand: "bg-brand text-brand" }[tone];
  return <span aria-hidden className={cx("inline-block size-1.5 shrink-0 rounded-full", c, pulse && "animate-kp-pulse")} />;
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label ?? "Copy"}
      title={done ? "Copied" : label ?? "Copy"}
      className={cx("inline-flex items-center gap-1.5 rounded-[var(--radius-xs)] px-1 py-0.5 text-[12px] text-muted transition-colors duration-150 hover:bg-hover hover:text-text", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        } catch {}
      }}
    >
      <Icon name={done ? "check" : "copy"} className={cx("size-3.5", done && "text-ok")} />
      {label && <span>{done ? "Copied" : label}</span>}
    </button>
  );
}

export function Mono({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cx("font-mono text-[12.5px] tracking-normal", className)}>
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, description, children, width = 420 }: { open: boolean; onClose: () => void; title: string; description?: ReactNode; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const first = ref.current?.querySelector<HTMLElement>("input, [data-autofocus], button:not([data-close])");
      (first ?? ref.current)?.focus();
    }, 10);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 animate-kp-fade bg-[var(--kp-backdrop)] backdrop-blur-[2px]" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ maxWidth: width }}
        className="kp-scroll relative max-h-[88vh] w-full animate-kp-sheet overflow-auto rounded-t-[var(--radius-lg)] border border-border bg-surface shadow-modal outline-none sm:rounded-[var(--radius-lg)]"
      >
        <header className="flex items-start gap-4 px-5 pt-5 pb-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <button type="button" data-close onClick={onClose} aria-label="Close" className="-mt-1 -mr-1.5 rounded-[var(--radius-sm)] p-1.5 text-muted transition-colors duration-150 hover:bg-hover hover:text-text">
            <Icon name="x" />
          </button>
        </header>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}

export function Input({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cx(
        "h-9 w-full min-w-0 rounded-[var(--radius-sm)] border border-border-strong bg-surface px-3 text-[13px] text-text transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-faint hover:border-[color-mix(in_srgb,var(--kp-border-strong)_70%,var(--kp-text-muted))] focus:border-brand focus:shadow-[0_0_0_3px_var(--kp-brand-soft)] focus:outline-none",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-text-2">{label}</span>
        {hint && <span className="text-[12px] text-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-[var(--radius-xs)] border border-border bg-surface-3 px-1 font-mono text-[10.5px] text-muted">{children}</kbd>;
}

function Logo({ asset, size, className }: { asset?: LogoAsset; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!asset || failed) return <span aria-hidden style={{ width: size, height: size }} className={cx("inline-block shrink-0", className)} />;
  return <img src={asset.src} alt="" width={size} height={size} onError={() => setFailed(true)} draggable={false} style={{ width: size, height: size }} className={cx("shrink-0 object-contain select-none", asset.mono && "kp-mono", className)} />;
}

export function ChainLogo({ network, size = 16, className }: { network: string; size?: number; className?: string }) {
  return <Logo asset={chainLogo(network)} size={size} className={className} />;
}

export function TokenLogo({ symbol, size = 16, className }: { symbol: string; size?: number; className?: string }) {
  return <Logo key={symbol} asset={tokenLogo(symbol)} size={size} className={className} />;
}
