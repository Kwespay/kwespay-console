import type { TransactionPayload, TransactionStatusResult } from "@kwespay/client";

export type StepState = "waiting" | "running" | "ok" | "failed" | "skipped";

export interface Step {
  id: string;
  label: string;
  method: string;
  state: StepState;
  ms?: number;
  request?: unknown;
  response?: unknown;
  error?: { code: string; message: string };
}

export interface LogLine {
  ts: string;
  network: string;
  step: string;
  ok: boolean | null;
  ms?: number;
  detail: string;
}

export type Phase = "idle" | "preparing" | "wallet" | "submitted" | "confirming" | "completed" | "failed";

export interface Run {
  id: string;
  network: string;
  asset: string;
  fiatAmount: number;
  fiatCurrency: string;
  startedAt: number;
  phase: Phase;
  phaseText: string;
  steps: Step[];
  logs: LogLine[];
  payload?: TransactionPayload;
  txHash?: string;
  final?: TransactionStatusResult;
  error?: unknown;
  submitted: boolean;
}

export interface Credentials {
  endpoint: string;
  apiKey: string;
  vendorId: string;
}
