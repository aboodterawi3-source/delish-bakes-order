import * as React from "react";

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`min-h-12 rounded-full border px-4 text-sm transition-colors ${
        active
          ? "border-gold bg-secondary font-semibold text-foreground"
          : "border-border text-foreground hover:border-gold/60"
      }`}
    >
      {children}
    </button>
  );
}
