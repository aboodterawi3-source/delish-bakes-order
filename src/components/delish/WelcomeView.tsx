import React from "react";
import { Link } from "@tanstack/react-router";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { FloatingMacaron } from "./FloatingMacaron";
import pistachioMacaron from "@/assets/macaron-pistachio.png";
import roseMacaron from "@/assets/macaron-rose.png";
import berryMacaron from "@/assets/macaron-berry.png";
import peachMacaron from "@/assets/macaron-peach.png";

interface WelcomeViewProps {
  onExplore?: () => void;
  isEmbedded?: boolean;
}

export function WelcomeView({ onExplore, isEmbedded = false }: WelcomeViewProps) {
  return (
    <div
      className={`relative isolate flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-background text-foreground select-none ${
        isEmbedded ? "min-h-[740px] max-h-[820px] rounded-[38px] shadow-2xl border-4 border-[#2A2421]" : ""
      }`}
    >
      {/* Organic sweeping background contours */}
      <BackgroundCurves />

      {/* Floating Corner Macaroon Graphics (isolated, outside photo boxes) */}
      {/* 1. Top-Left: Stacked Green & Pastel Blue macaroons */}
      <FloatingMacaron
        src={pistachioMacaron}
        alt="Pistachio macaron"
        className="-left-14 -top-14 w-40 rotate-[-14deg] sm:-left-10 sm:-top-12 sm:w-52 lg:w-64"
      />

      {/* 2. Top-Right: Stacked Pistachio Green, Blue, Pink & Yellow macaroons */}
      <FloatingMacaron
        src={roseMacaron}
        alt="Rose pink macaron"
        className="-right-14 -top-14 w-40 rotate-[13deg] sm:-right-10 sm:-top-12 sm:w-52 lg:w-64"
      />

      {/* 3. Bottom-Left: Pistachio & Pastel Blue macaroons */}
      <FloatingMacaron
        src={berryMacaron}
        alt="Berry pink macaron"
        className="-bottom-16 -left-14 w-40 rotate-[14deg] sm:-bottom-14 sm:-left-10 sm:w-52 lg:w-64"
      />

      {/* 4. Bottom-Right: Pastel Blue, Pink & Yellow macaroons */}
      <FloatingMacaron
        src={peachMacaron}
        alt="Warm peach macaron"
        className="-bottom-16 -right-14 w-40 rotate-[-13deg] sm:-bottom-14 sm:-right-10 sm:w-52 lg:w-64"
      />

      {/* Top Header */}
      <header className="relative z-10 flex justify-center pt-20 sm:pt-16">
        <DelishLogo size="lg" />
      </header>

      {/* Center Content Block */}
      <main className="relative z-10 mx-auto flex max-w-xl flex-col items-center px-8 py-8 text-center">
        {/* Subtitle: SMALL JOYS, BAKED DAILY */}
        <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.28em] text-[#B8860B] drop-shadow-sm">
          Small Joys, Baked Daily
        </p>

        {/* Main Headline: CLOSER TO LOVE WITH every bite */}
        <h1 className="mt-5 font-sans text-3xl sm:text-5xl font-extrabold uppercase text-foreground leading-[1.14]">
          Closer to Love <br />
          With{" "}
          <span className="font-script lowercase font-normal italic text-primary text-5xl sm:text-7xl normal-case inline-block -translate-y-1">
            every bite
          </span>
        </h1>

        {/* Descriptive paragraph */}
        <p className="mt-6 max-w-sm text-xs sm:text-sm leading-relaxed text-muted-foreground">
          Indulge in the deliciousness of freshly baked treats to kickstart your mornings with joy!
        </p>

        {/* CTA Button: LET'S EXPLORE */}
        <div className="mt-8 sm:mt-10">
          {onExplore ? (
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-secondary px-8 py-3 text-xs sm:text-sm font-semibold uppercase text-secondary-foreground shadow-sm transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              Let's Explore
            </button>
          ) : (
            <Link
              to="/discover"
              className="inline-flex min-h-[50px] items-center justify-center rounded-full bg-secondary px-8 py-3 text-xs sm:text-sm font-semibold uppercase text-secondary-foreground shadow-sm transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
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
