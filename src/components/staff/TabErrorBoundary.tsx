import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface TabErrorBoundaryProps {
  tabName: string;
  children: ReactNode;
}

interface TabErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  override state: TabErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): TabErrorBoundaryState {
    return {
      hasError: true,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`[TabErrorBoundary:${this.props.tabName}]`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="mx-auto max-w-2xl p-6 sm:p-10" dir="rtl">
        <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-6 sm:p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="font-display text-lg font-bold text-foreground">
            حدث خطأ غير متوقع في قسم {this.props.tabName}
          </h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            تم عزل هذا العطل بنجاح لضمان استمرار عمل باقي أقسام النظام والكاشير دون انقطاع.
          </p>
          {this.state.error?.message && (
            <div className="my-4 rounded-xl border border-destructive/10 bg-background/80 p-3 text-xs font-mono text-destructive text-start overflow-x-auto max-h-32">
              {this.state.error.message}
            </div>
          )}
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 transition cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              <span>إعادة تحميل هذا التبويب</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
