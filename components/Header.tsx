"use client";

import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "@/src/storage";
import { Icon, StatusDot, cx } from "./ui";

type Theme = "system" | "light" | "dark";
type Health = "checking" | "ok" | "down";

const SDK_VERSION = process.env.NEXT_PUBLIC_SDK_VERSION;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const NEXT_THEME: Record<Theme, Theme> = {
  system: "light",
  light: "dark",
  dark: "system",
};
const THEME_ICON = { system: "monitor", light: "sun", dark: "moon" } as const;

function host(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return endpoint;
  }
}

export function Header({ endpoint }: { endpoint: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [health, setHealth] = useState<Health>("checking");

  useEffect(() => {
    const t = readLocal("kp-theme");
    setTheme(t === "light" || t === "dark" ? t : "system");
  }, []);

  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    writeLocal("kp-theme", theme === "system" ? "" : theme);
  }, [theme]);

  useEffect(() => {
    let alive = true;
    const url = endpoint.replace(/\/graphql\/?$/, "/health");
    const check = async () => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (alive) setHealth(r.ok ? "ok" : "down");
      } catch {
        if (alive) setHealth("down");
      }
    };
    void check();
    const id = setInterval(check, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [endpoint]);

  const current = theme ?? "system";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
        <a
          href={`${BASE}/`}
          aria-label="KwesPay Console"
          className="flex items-center gap-2.5"
        >
          <img
            src={`${BASE}/brand/kwespay-wordmark.png`}
            alt="KwesPay"
            width={77}
            height={18}
            className="kp-logo h-[18px] w-auto select-none"
            draggable={false}
          />
          <span aria-hidden className="h-4 w-px bg-border-strong" />
          <span className="text-[14px] font-medium tracking-[-0.01em] text-text-2">
            Console
          </span>
        </a>

        <div className="ml-auto flex items-center gap-1 text-[12px]">
          {SDK_VERSION && (
            <span className="hidden items-center gap-1.5 px-2 text-muted md:flex">
              <span className="font-mono">@kwespay/client</span>
              <span className="font-mono text-faint">v{SDK_VERSION}</span>
            </span>
          )}
          {SDK_VERSION && (
            <span
              aria-hidden
              className="mx-1 hidden h-4 w-px bg-border md:block"
            />
          )}
          <span className="flex items-center gap-2 px-2" title={endpoint}>
            <StatusDot
              tone={
                health === "ok" ? "ok" : health === "down" ? "error" : "idle"
              }
            />
            <span
              className={cx(health === "down" ? "text-error" : "text-text-2")}
            >
              {health === "ok"
                ? "API healthy"
                : health === "down"
                  ? "API unreachable"
                  : "Checking API"}
            </span>
            <span className="hidden font-mono text-faint lg:inline">
              {host(endpoint)}
            </span>
          </span>
          <span aria-hidden className="mx-1 h-4 w-px bg-border" />
          <button
            type="button"
            onClick={() => setTheme(NEXT_THEME[current])}
            aria-label={`Theme: ${current}. Switch to ${NEXT_THEME[current]}`}
            title={`Theme: ${current}`}
            className="rounded-[var(--radius-sm)] p-1.5 text-muted transition-colors duration-150 hover:bg-hover hover:text-text"
          >
            <Icon name={THEME_ICON[current]} />
          </button>
        </div>
      </div>
    </header>
  );
}
