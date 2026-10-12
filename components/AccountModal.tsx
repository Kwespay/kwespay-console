"use client";

import { useEffect, useState } from "react";
import type { Credentials } from "@/src/sdk/run";
import { Button, Field, Icon, Input, Modal, cx } from "./ui";

export function AccountModal({
  open,
  onClose,
  connected,
  connecting,
  vendorName,
  error,
  credentials,
  defaultEndpoint,
  onConnect,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  connected: boolean;
  connecting: boolean;
  vendorName?: string;
  error?: string;
  credentials?: Credentials;
  defaultEndpoint: string;
  onConnect: (c: Credentials) => void;
  onSignOut: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [endpoint, setEndpoint] = useState(defaultEndpoint);
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    setApiKey(credentials?.apiKey ?? "");
    setVendorId(credentials?.vendorId ?? "");
    setEndpoint(credentials?.endpoint ?? defaultEndpoint);
    setAdvanced(Boolean(credentials?.endpoint && credentials.endpoint !== defaultEndpoint));
  }, [open, credentials, defaultEndpoint]);

  return (
    <Modal open={open} onClose={onClose} title={connected ? "KwesPay account" : "Connect KwesPay"} description={connected ? <>Connected as <span className="font-medium text-text-2">{vendorName}</span></> : "Use the API key and Vendor ID from your KwesPay dashboard."}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onConnect({ apiKey: apiKey.trim(), vendorId: vendorId.trim(), endpoint: endpoint.trim() });
        }}
      >
        <Field label="API key">
          <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="pk_test_…" autoComplete="off" spellCheck={false} type="password" required className="font-mono text-[12.5px]" />
        </Field>
        <Field label="Vendor ID">
          <Input value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="vendor_…" autoComplete="off" spellCheck={false} required className="font-mono text-[12.5px]" />
        </Field>

        <div>
          <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="inline-flex items-center gap-1 text-[12px] text-muted transition-colors duration-150 hover:text-text">
            <Icon name="chevron-right" className={cx("size-3 transition-transform duration-150", advanced && "rotate-90")} />
            API endpoint
          </button>
          <div className="kp-collapse" data-open={advanced}>
            <div>
              <div className="pt-2.5">
                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} spellCheck={false} tabIndex={advanced ? 0 : -1} aria-label="API endpoint" className="font-mono text-[12.5px]" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[var(--radius-sm)] border border-error/20 bg-error-bg px-3 py-2 text-[12.5px] text-error">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 border-t border-hairline pt-4">
          {connected && (
            <Button variant="ghost" size="sm" onClick={onSignOut} className="-ml-2 text-muted">
              Sign out
            </Button>
          )}
          <span className="ml-auto text-[11.5px] text-faint">Stored in this tab only</span>
          <Button type="submit" variant="primary" size="md" loading={connecting}>
            {connected ? "Reconnect" : "Connect"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
