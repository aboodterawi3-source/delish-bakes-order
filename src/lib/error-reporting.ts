/**
 * Application Runtime & Boundary Error Reporting
 * Captures uncaught exceptions from React boundaries and route loaders.
 */

export type ErrorSeverity = "error" | "warning" | "info";

export interface ErrorReportContext {
  boundary?: string;
  route?: string;
  handled?: boolean;
  severity?: ErrorSeverity;
  [key: string]: unknown;
}

export function reportError(error: unknown, context: ErrorReportContext = {}): void {
  if (typeof window === "undefined") {
    console.error("[SSR Error]", error, context);
    return;
  }

  const message =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : error instanceof Error
        ? error.message
        : String(error ?? "Unknown error");

  const stack = error instanceof Error ? error.stack : undefined;

  // Log locally in development and production console
  console.error(`[Delish Error:${context.boundary || "app"}]`, message, {
    stack,
    route: window.location.pathname,
    ...context,
  });
}
