import React from "react";

interface FloatingMacaronProps {
  src: string;
  alt: string;
  className?: string;
}

export function FloatingMacaron({ src, alt, className = "" }: FloatingMacaronProps) {
  return (
    <div className={`pointer-events-none absolute select-none drop-shadow-xl ${className}`}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        width={240}
        height={240}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
      />
    </div>
  );
}
