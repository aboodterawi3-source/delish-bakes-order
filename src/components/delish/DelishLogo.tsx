import React from "react";

interface DelishLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showSubtitle?: boolean;
}

export function DelishLogo({ size = "md", className = "", showSubtitle = false }: DelishLogoProps) {
  const sizeStyles = {
    sm: { main: "text-lg tracking-[0.18em]", script: "text-xl -mt-2", sub: "text-[9px]" },
    md: { main: "text-2xl tracking-[0.2em]", script: "text-3xl -mt-3", sub: "text-[10px]" },
    lg: { main: "text-3xl sm:text-4xl tracking-[0.22em]", script: "text-4xl sm:text-5xl -mt-4", sub: "text-xs" },
    xl: { main: "text-4xl sm:text-5xl tracking-[0.25em]", script: "text-5xl sm:text-6xl -mt-5", sub: "text-sm" },
  }[size];

  return (
    <div className={`flex flex-col items-center select-none text-center ${className}`}>
      {/* Serif DELISH */}
      <span className={`font-serif font-bold text-[#B8860B] uppercase drop-shadow-[0_1px_1px_rgba(184,134,11,0.15)] ${sizeStyles.main}`}>
        DELISH
      </span>
      {/* Script Bakes */}
      <span className={`font-script text-[#8B4513] italic font-normal z-10 leading-none ${sizeStyles.script}`}>
        Bakes
      </span>
      {showSubtitle && (
        <span className={`uppercase font-semibold tracking-[0.28em] text-[#B8860B] mt-1 ${sizeStyles.sub}`}>
          Small Joys, Baked Daily
        </span>
      )}
    </div>
  );
}
