import type { Phase, Run, Step } from "./types";

function clock(): string {
  return new Date().toISOString().slice(11, 23);
}

function codeOf(e: unknown): string {
  const code = (e as { code?: unknown })?.code;
  if (typeof code === "string") return code;
  if (code === 4001) return "WALLET_REJECTED";
  return "UNKNOWN";
}

export function step(id: string, label: string, method: string): Step {
  return { id, label, method, state: "waiting" };
}

export function createTracer(run: Run, onUpdate: (run: Run) => void) {
  const emit = () => onUpdate({ ...run, steps: run.steps.map((s) => ({ ...s })), logs: [...run.logs] });

  const patch = (id: string, change: Partial<Step>) => {
    run.steps = run.steps.map((s) => (s.id === id ? { ...s, ...change } : s));
  };

  const log = (stepName: string, ok: boolean | null, detail: string, ms?: number) => {
    run.logs.push({ ts: clock(), network: run.network, step: stepName, ok, ms, detail });
  };

  async function call<T>(id: string, request: unknown, sdkCall: () => Promise<T>, describe: (result: T) => string = () => "ok"): Promise<T> {
    const started = performance.now();
    patch(id, { state: "running", request });
    emit();
    try {
      const result = await sdkCall();
      const ms = Math.round(performance.now() - started);
      patch(id, { state: "ok", ms, response: result });
      log(id, true, describe(result), ms);
      emit();
      return result;
    } catch (e) {
      const ms = Math.round(performance.now() - started);
      const message = String((e as Error)?.message ?? e);
      patch(id, { state: "failed", ms, error: { code: codeOf(e), message } });
      log(id, false, message, ms);
      throw e;
    }
  }

  function phase(next: Phase, text: string) {
    run.phase = next;
    run.phaseText = text;
    emit();
  }

  function note(stepName: string, detail: string) {
    log(stepName, null, detail);
    emit();
  }

  function fail(error: unknown) {
    run.steps = run.steps.map((s) => (s.state === "waiting" ? { ...s, state: "skipped" } : s));
    run.error = error;
    phase("failed", run.phaseText);
  }

  function markFailed(id: string, response: unknown, ms?: number) {
    patch(id, { state: "failed", response, ms });
  }

  return { call, phase, note, fail, markFailed, emit };
}
