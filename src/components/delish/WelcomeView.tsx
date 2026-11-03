import React from "react";
import { Link } from "@tanstack/react-router";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { FloatingMacaron } from "./FloatingMacaron";
import pistachioMacaron from "@/assets/macaron-pistachio.webp";
import roseMacaron from "@/assets/macaron-rose.webp";
import berryMacaron from "@/assets/macaron-berry.webp";
import peachMacaron from "@/assets/macaron-peach.webp";

interface WelcomeViewProps {
  onExplore?: () => void;
  isEmbedded?: boolean;
}

export function WelcomeView({ onExplore, isEmbedded = false }: WelcomeViewProps) {
  return (
    <div
      className={`relative isolate flex min-h-dvh w-full flex-col justify-between overflow-hidden bg-background text-foreground select-none ${
        isEmbedded
          ? "max-h-[820px] min-h-[740px] rounded-[38px] border-4 border-foreground/80 shadow-2xl"
          : ""
      }`}
    >
      {/* Organic sweeping background contours */}
      <BackgroundCurves />

      {/* Floating Corner Macaron Graphics (isolated, outside photo boxes) */}
      <FloatingMacaron
        src={pistachioMacaron}
        alt="Pistachio macaron"
        className="-top-14 -left-14 w-40 rotate-[-14deg] sm:-top-12 sm:-left-10 sm:w-52 lg:w-64"
      />

      <FloatingMacaron
        src={roseMacaron}
        alt="Rose pink macaron"
        className="-top-14 -right-14 w-40 rotate-[13deg] sm:-top-12 sm:-right-10 sm:w-52 lg:w-64"
      />

      <FloatingMacaron
        src={berryMacaron}
        alt="Berry pink macaron"
        className="-bottom-16 -left-14 w-40 rotate-[14deg] sm:-bottom-14 sm:-left-10 sm:w-52 lg:w-64"
      />

      <FloatingMacaron
        src={peachMacaron}
        alt="Warm peach macaron"
        className="-right-14 -bottom-16 w-40 rotate-[-13deg] sm:-right-10 sm:-bottom-14 sm:w-52 lg:w-64"
      />

      {/* Top Header */}
      <header className="relative z-10 flex justify-center pt-16 sm:pt-20">
        <DelishLogo size="lg" />
      </header>

      {/* Center Content Block */}
      <main className="relative z-10 mx-auto flex w-full max-w-xl min-w-0 flex-col items-center px-4 py-8 text-center sm:px-8">
        {/* Subtitle */}
        <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">
          Small Joys, Baked Daily
        </p>

        {/* Main Headline */}
        <h1 className="mt-4 max-w-full font-display text-4xl leading-[1.12] font-extrabold break-words text-foreground uppercase sm:text-6xl">
          Closer to Love <br />
          With{" "}
          <span className="inline-block -translate-y-1 font-script text-6xl font-normal text-primary lowercase normal-case italic sm:text-8xl">
            every bite
          </span>
        </h1>

        {/* Descriptive paragraph */}
        <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Indulge in the deliciousness of freshly baked treats to kickstart your mornings with joy!
        </p>

        {/* Tactile CTA Button */}
        <div className="mt-8 sm:mt-10">
          {onExplore ? (
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary px-9 py-3.5 text-xs font-bold tracking-wider text-primary-foreground uppercase shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 sm:text-sm"
            >
              Let's Explore
            </button>
          ) : (
            <Link
              to="/discover"
              className="inline-flex min-h-[52px] cursor-pointer items-center justify-center rounded-full bg-primary px-9 py-3.5 text-xs font-bold tracking-wider text-primary-foreground uppercase shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 sm:text-sm"
            >
              Let's Explore
            </Link>
          )}
        </div>
      </main>

      {/* Bottom spacer for balance */}
      <footer className="relative z-10 pb-8 text-center text-xs font-medium tracking-wider text-muted-foreground/80 uppercase sm:pb-12">
        Delish Cake &amp; Bake · Amman, Jordan
      </footer>
    </div>
  );
}
