import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * Last-resort boundary. React rethrows any value a component throws — including
 * a bare `undefined` — and when that value is not an Error the router's own
 * boundary can fail to render, leaving a blank screen. This boundary accepts
 * any thrown value and always renders a readable retry screen.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[app-error-boundary]", error ?? "undefined thrown value", info.componentStack);
    reportLovableError(error ?? new Error("Undefined value thrown during render"), {
      boundary: "app_error_boundary",
    });
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-foreground">تعذّر تحميل الشاشة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            حدث خطأ غير متوقع. جرّب إعادة التحميل أو الرجوع للصفحة الرئيسية.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={() => {
                this.setState({ failed: false });
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              إعادة المحاولة · Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground"
            >
              الرئيسية · Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
