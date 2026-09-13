import React from "react";
import { Link } from "@tanstack/react-router";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { FloatingMacaron } from "./FloatingMacaron";

interface WelcomeViewProps {
  onExplore?: () => void;
  isEmbedded?: boolean;
}

export function WelcomeView({ onExplore, isEmbedded = false }: WelcomeViewProps) {
  return (
    <div
      className={`relative flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-[#F9FBFC] text-[#3E2723] select-none ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-[#2A2421]" : ""
      }`}
    >
      {/* Organic sweeping background contours */}
      <BackgroundCurves />

      {/* Floating Corner Macaroon Graphics (isolated, outside photo boxes) */}
      {/* 1. Top-Left: Stacked Green & Pastel Blue macaroons */}
      <FloatingMacaron
        src="/images/macaron-pair.jpg"
        alt="Pistachio & Pastel Blue Macarons"
        className="-left-10 -top-8 w-44 sm:w-52 md:w-56"
        style={{ transform: "rotate(-12deg)" }}
      />

      {/* 2. Top-Right: Stacked Pistachio Green, Blue, Pink & Yellow macaroons */}
      <FloatingMacaron
        src="/images/macaron-stack.jpg"
        alt="Pistachio, Blue, Pink & Yellow Macaron Stack"
        className="-right-10 -top-10 w-44 sm:w-52 md:w-56"
        style={{ transform: "rotate(10deg)" }}
      />

      {/* 3. Bottom-Left: Pistachio & Pastel Blue macaroons */}
      <FloatingMacaron
        src="/images/macaron-pair.jpg"
        alt="Pistachio & Pastel Blue Macarons"
        className="-bottom-10 -left-10 w-44 sm:w-52 md:w-56"
        style={{ transform: "scaleX(-1) rotate(15deg)" }}
      />

      {/* 4. Bottom-Right: Pastel Blue, Pink & Yellow macaroons */}
      <FloatingMacaron
        src="/images/macaron-stack.jpg"
        alt="Pastel Blue, Pink & Yellow Macarons"
        className="-bottom-12 -right-10 w-44 sm:w-52 md:w-56"
        style={{ transform: "rotate(-12deg)" }}
      />

      {/* Top Header */}
      <header className="relative z-10 pt-10 sm:pt-14 flex justify-center">
        <DelishLogo size="lg" />
      </header>

      {/* Center Content Block */}
      <main className="relative z-10 mx-auto flex max-w-md flex-col items-center px-6 py-6 text-center">
        {/* Subtitle: SMALL JOYS, BAKED DAILY */}
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.28em] text-[#B8860B] drop-shadow-sm">
          Small Joys, Baked Daily
        </p>

        {/* Main Headline: CLOSER TO LOVE WITH every bite */}
        <h1 className="mt-4 font-sans text-3xl sm:text-4xl font-extrabold uppercase tracking-tight text-[#1F140E] leading-[1.18]">
          Closer to Love <br />
          With{" "}
          <span className="font-script lowercase font-normal italic text-[#8B4513] text-5xl sm:text-6xl tracking-normal normal-case inline-block transform -translate-y-1">
            every bite
          </span>
        </h1>

        {/* Descriptive paragraph */}
        <p className="mt-5 max-w-[310px] text-xs sm:text-sm leading-relaxed text-[#5A4A42]">
          Indulge in the deliciousness of freshly baked treats to kickstart your mornings with joy!
        </p>

        {/* CTA Button: LET'S EXPLORE */}
        <div className="mt-8 sm:mt-10">
          {onExplore ? (
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#FDE2CF] px-9 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#7B3F00] shadow-[0_10px_25px_-5px_rgba(239,167,129,0.45)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#fed6bc] hover:shadow-[0_12px_28px_-4px_rgba(239,167,129,0.55)] active:scale-[0.98]"
            >
              Let's Explore
            </button>
          ) : (
            <Link
              to="/discover"
              className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-[#FDE2CF] px-9 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-[#7B3F00] shadow-[0_10px_25px_-5px_rgba(239,167,129,0.45)] transition-all duration-300 hover:scale-[1.03] hover:bg-[#fed6bc] hover:shadow-[0_12px_28px_-4px_rgba(239,167,129,0.55)] active:scale-[0.98]"
            >
              Let's Explore
            </Link>
          )}
        </div>
      </main>

      {/* Bottom spacer for balance */}
      <footer className="relative z-10 pb-8 sm:pb-12 text-center text-[10px] text-[#A08C82] tracking-wider uppercase font-medium">
        Delish Cake &amp; Bake · Amman, Jordan
      </footer>
    </div>
  );
}
