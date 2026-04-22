/**
 * PANG — OTel GenAI spans (A10, A16).
 *
 * Thin shim around the OpenTelemetry API for agent call sites.
 * Iteration #1 emits spans; a collector lands in iteration #5 — the
 * spans just go to `console.debug` in dev until then, with the same
 * attribute names the collector will consume.
 *
 * Attribute names follow the OpenTelemetry GenAI semantic
 * conventions (`gen_ai.*`). Our own attributes live under `pang.*`.
 *
 *   gen_ai.system          = "anthropic"
 *   gen_ai.request.model   = <model id>
 *   gen_ai.operation.name  = "agent.intake" | "agent.intake.q" | ...
 *   gen_ai.usage.input_tokens
 *   gen_ai.usage.output_tokens
 *   pang.agent.trust_sources[]
 *   pang.cost.usd
 *   pang.budget.exceeded
 */

export type SpanAttributes = Record<
  string,
  string | number | boolean | readonly string[]
>;

export interface Span {
  setAttribute(key: string, value: SpanAttributes[string]): void;
  setStatus(status: "ok" | "error", message?: string): void;
  recordException(err: unknown): void;
  end(): void;
}

/**
 * Run `fn` inside a span. The returned span ends automatically when
 * the promise resolves or rejects — callers must not call `.end()`
 * themselves.
 */
export async function withOtelSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  initialAttrs: SpanAttributes = {},
): Promise<T> {
  const span = createSpan(name, initialAttrs);
  try {
    const result = await fn(span);
    span.setStatus("ok");
    return result;
  } catch (err) {
    span.recordException(err);
    span.setStatus("error", err instanceof Error ? err.message : String(err));
    throw err;
  } finally {
    span.end();
  }
}

/**
 * Factory. Until the iteration-#5 OTel collector lands, this returns
 * a span that writes structured events to stderr — the shape is the
 * shape the collector will consume. No value is ever lost.
 */
function createSpan(name: string, initialAttrs: SpanAttributes): Span {
  const start = performance.now();
  const attrs: SpanAttributes = { ...initialAttrs };
  let status: "ok" | "error" | "unset" = "unset";
  let statusMessage: string | undefined;
  let exception: unknown;

  return {
    setAttribute(key, value) {
      attrs[key] = value;
    },
    setStatus(next, message) {
      status = next;
      statusMessage = message;
    },
    recordException(err) {
      exception = err;
    },
    end() {
      const durationMs = Math.round(performance.now() - start);
      const payload = {
        span: name,
        durationMs,
        status,
        statusMessage,
        attrs,
        exception:
          exception instanceof Error
            ? { name: exception.name, message: exception.message }
            : exception,
      };
      // Single-line JSON — the collector ingests it directly.
      console.debug(JSON.stringify(payload));
    },
  };
}
