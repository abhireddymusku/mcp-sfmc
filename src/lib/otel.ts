/**
 * Minimal OpenTelemetry-compatible tracing wrapper.
 * Uses structural typing — works with @opentelemetry/api or any compatible tracer.
 * No @opentelemetry/api package dependency required.
 */

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void
  setStatus(status: { code: 0 | 1 | 2; message?: string }): void
  recordException(error: Error): void
  end(): void
}

export interface Tracer {
  startActiveSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T>
}

export async function traced<T>(
  tracer: Tracer | undefined,
  spanName: string,
  attrs: Record<string, string | number>,
  fn: () => Promise<T>
): Promise<T> {
  if (!tracer) return fn()

  return tracer.startActiveSpan(`sfmc.${spanName}`, async (span) => {
    for (const [k, v] of Object.entries(attrs)) {
      span.setAttribute(k, v)
    }
    try {
      const result = await fn()
      span.setStatus({ code: 1 })
      return result
    } catch (err) {
      span.setStatus({ code: 2, message: err instanceof Error ? err.message : String(err) })
      if (err instanceof Error) span.recordException(err)
      throw err
    } finally {
      span.end()
    }
  })
}
