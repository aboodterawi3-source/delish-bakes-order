import { getStatusMeta } from "@/lib/order-status";

export interface OrderStatusBadgeProps {
  status: string | null | undefined;
  showDot?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md";
  lang?: "ar" | "en";
  className?: string;
}

export function OrderStatusBadge({
  status,
  showDot = false,
  showIcon = false,
  size = "sm",
  lang = "ar",
  className = "",
}: OrderStatusBadgeProps) {
  const meta = getStatusMeta(status);
  const label = lang === "ar" ? meta.ar : meta.en;

  const sizeClasses =
    size === "md"
      ? "text-xs px-2.5 py-1 gap-1.5"
      : "text-[11px] px-2 py-0.5 gap-1";

  return (
    <span
      className={`inline-flex items-center font-bold rounded-full border shadow-2xs ${meta.chip} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${meta.dot} shrink-0`}
          aria-hidden="true"
        />
      )}
      {showIcon && <span aria-hidden="true">{meta.icon}</span>}
      <span>{label}</span>
    </span>
  );
}
