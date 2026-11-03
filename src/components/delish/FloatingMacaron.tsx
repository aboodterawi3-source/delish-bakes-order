import React from "react";

interface FloatingMacaronProps {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}

export function FloatingMacaron({
  src,
  alt,
  className = "",
  priority = true,
}: FloatingMacaronProps) {
  return (
    <div className={`pointer-events-none absolute select-none drop-shadow-xl ${className}`}>
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        width={240}
        height={240}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "low"}
      />
    </div>
  );
}
