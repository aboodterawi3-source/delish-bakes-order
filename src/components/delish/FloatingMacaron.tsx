import React from "react";

interface FloatingMacaronProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

export function FloatingMacaron({ src, alt, className = "", style = {} }: FloatingMacaronProps) {
  return (
    <div
      className={`pointer-events-none absolute select-none mix-blend-multiply opacity-95 ${className}`}
      style={{
        filter: "drop-shadow(0 14px 28px rgba(62, 39, 35, 0.12))",
        ...style,
      }}
    >
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain [mask-image:radial-gradient(circle_at_center,black_70%,transparent_96%)]"
        loading="eager"
      />
    </div>
  );
}
