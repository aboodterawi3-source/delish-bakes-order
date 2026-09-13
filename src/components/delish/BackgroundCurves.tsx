import React from "react";

export function BackgroundCurves({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <svg
        className="absolute inset-0 h-full w-full opacity-45"
        viewBox="0 0 1000 1200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Sweeping contour curve 1: gold accent */}
        <path
          d="M-150 120 C 180 80, 320 280, 480 340 C 640 400, 820 220, 1150 380"
          stroke="#B8860B"
          strokeWidth="1.2"
          strokeOpacity="0.25"
          fill="none"
        />
        {/* Sweeping contour curve 2: warm peach accent */}
        <path
          d="M-80 340 C 220 300, 360 620, 560 680 C 760 740, 880 520, 1200 640"
          stroke="#EFA781"
          strokeWidth="1.4"
          strokeOpacity="0.3"
          fill="none"
        />
        {/* Sweeping contour curve 3: deep bronze soft wave */}
        <path
          d="M-200 650 C 120 600, 300 880, 580 920 C 860 960, 940 820, 1250 960"
          stroke="#8B4513"
          strokeWidth="1"
          strokeOpacity="0.18"
          fill="none"
        />
        {/* Deep background diagonal sweep */}
        <path
          d="M120 -80 C 240 280, 480 580, 720 880 C 880 1080, 1020 1180, 1120 1320"
          stroke="#B8860B"
          strokeWidth="0.8"
          strokeOpacity="0.15"
          fill="none"
        />
      </svg>
      {/* Soft warm radial glow spots */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#FDE2CF]/35 blur-3xl" />
      <div className="absolute top-1/2 -right-32 h-96 w-96 rounded-full bg-[#EFA781]/20 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-96 w-96 rounded-full bg-[#FDE2CF]/25 blur-3xl" />
    </div>
  );
}
