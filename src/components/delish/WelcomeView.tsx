import React from "react";
import { Link } from "@tanstack/react-router";
import { Cake, Sparkles, Truck, ChevronLeft, ArrowLeft } from "lucide-react";
import { DelishLogo } from "./DelishLogo";
import { BackgroundCurves } from "./BackgroundCurves";
import { FloatingMacaron } from "./FloatingMacaron";
import luxuryCakeShowcaseImg from "@/assets/luxury-cake-showcase.jpg";
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
      dir="rtl"
      className={`relative isolate flex min-h-dvh w-full flex-col justify-between overflow-x-hidden bg-background text-foreground select-none ${
        isEmbedded
          ? "max-h-[820px] min-h-[740px] rounded-[38px] border-4 border-foreground/80 shadow-2xl"
          : ""
      }`}
    >
      {/* Organic sweeping background contours */}
      <BackgroundCurves />

      {/* Floating Corner Macaron Graphics (subtle artisan peripheral accents) */}
      <FloatingMacaron
        src={pistachioMacaron}
        alt="Pistachio macaron"
        className="-top-10 -left-10 w-28 rotate-[-12deg] opacity-75 sm:w-44 lg:w-56"
      />
      <FloatingMacaron
        src={roseMacaron}
        alt="Rose pink macaron"
        className="-top-10 -right-10 w-28 rotate-[15deg] opacity-75 sm:w-44 lg:w-56"
      />
      <FloatingMacaron
        src={berryMacaron}
        alt="Berry pink macaron"
        className="-bottom-12 -left-10 w-28 rotate-[14deg] opacity-75 sm:w-44 lg:w-56"
      />
      <FloatingMacaron
        src={peachMacaron}
        alt="Warm peach macaron"
        className="-right-10 -bottom-12 w-28 rotate-[-14deg] opacity-75 sm:w-44 lg:w-56"
      />

      {/* Top Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <div className="flex items-center gap-3">
          <DelishLogo size="md" />
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-muted-foreground shadow-2xs backdrop-blur-xs sm:inline-flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            نستقبل طلباتكم الآن في عمّان
          </span>
        </div>
      </header>

      {/* Center Main Stage */}
      <main className="relative z-10 mx-auto my-auto flex w-full max-w-6xl flex-1 items-center px-5 py-6 sm:px-8 sm:py-10">
        <div className="grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Text & Action Column */}
          <div className="flex flex-col items-start text-start lg:col-span-7">
            {/* Boutique Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-2xs">
              <Sparkles className="h-3.5 w-3.5" />
              <span>مخبز بوتيك فاخر · عمّان، الأردن</span>
            </div>

            {/* Main Arabic Headline */}
            <h1 className="mt-4 font-sans text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.18]">
              كيك ومخبوزات فاخرة
              <span className="mt-1 block font-serif font-bold text-primary italic">
                تُصنع بحب لكل مناسبة
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
              تصاميم كيك احتفالية مبتكرة ومعجنات فرنسية طازجة، تُخبز يومياً بأجود المكونات الطبيعية
              لتجعل من مناسباتكم ولحظاتكم السعيدة ذكرى لا تُنسى.
            </p>

            {/* Value Highlights */}
            <div className="mt-6 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs">
                <Cake className="h-4 w-4 text-primary" />
                <span>كيك احتفالي وتصاميم مخصصة</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-2xs">
                <Truck className="h-4 w-4 text-primary" />
                <span>توصيل مبرد وآمن في عمّان</span>
              </span>
            </div>

            {/* Action Buttons: Prominent «تصفّح الكيك» Button */}
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-4">
              {onExplore ? (
                <button
                  type="button"
                  onClick={onExplore}
                  className="group inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 sm:w-auto"
                >
                  <Cake className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
                  <span>تصفّح الكيك</span>
                  <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                </button>
              ) : (
                <Link
                  to="/discover"
                  className="group inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-95 sm:w-auto"
                >
                  <Cake className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />
                  <span>تصفّح الكيك</span>
                  <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
                </Link>
              )}

              <Link
                to="/discover"
                className="inline-flex min-h-[52px] w-full cursor-pointer items-center justify-center rounded-2xl border border-border bg-card px-6 py-3.5 text-sm font-semibold text-foreground shadow-2xs transition-all duration-200 hover:bg-secondary/40 active:scale-95 sm:w-auto"
              >
                قائمة الحلويات والمعجنات
              </Link>
            </div>
          </div>

          {/* Large Hero Cake Showcase Column */}
          <div className="relative flex justify-center lg:col-span-5">
            {/* Visual Ambient Halo */}
            <div className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-gradient-to-tr from-primary/10 via-amber-100/40 to-transparent blur-xl" />

            <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border-2 border-border/80 bg-card p-3 shadow-xl transition-transform duration-300 hover:scale-[1.01] sm:p-4">
              {/* Product Photo Showcase */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl sm:aspect-[4/3] lg:aspect-[1/1]">
                <img
                  src={luxuryCakeShowcaseImg}
                  alt="كيكة فاخرة من ديليش كيك آند بيك"
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  loading="eager"
                  fetchPriority="high"
                />

                {/* Floating Showcase Badges */}
                <div className="absolute top-3 right-3 rounded-xl border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-bold text-white shadow-md backdrop-blur-md">
                  ✨ كيكة التوقيع · Signature Cake
                </div>

                <div className="absolute right-3 bottom-3 left-3 flex items-center justify-between rounded-xl border border-white/20 bg-black/50 px-3.5 py-2 text-xs text-white shadow-md backdrop-blur-md">
                  <span className="font-bold">طبقات الكيك الفاخر وحشوات التوت</span>
                  <span className="font-semibold text-amber-300">خبيز يدوي متقن</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 border-t border-border/60 py-4 text-center text-xs font-medium text-muted-foreground">
        <p>ديليش كيك آند بيك · عمّان، الأردن — Delish Cake &amp; Bake Amman</p>
      </footer>
    </div>
  );
}
