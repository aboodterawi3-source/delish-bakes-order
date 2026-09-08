// Auto-composed responsive image sets (AVIF + WebP + JPEG fallback).

import cake_choc_jpg from "@/assets/cake-choc.jpg";
import cake_choc_400_avif from "@/assets/opt/cake-choc-400.avif";
import cake_choc_400_webp from "@/assets/opt/cake-choc-400.webp";
import cake_choc_800_avif from "@/assets/opt/cake-choc-800.avif";
import cake_choc_800_webp from "@/assets/opt/cake-choc-800.webp";
import cake_berry_jpg from "@/assets/cake-berry.jpg";
import cake_berry_400_avif from "@/assets/opt/cake-berry-400.avif";
import cake_berry_400_webp from "@/assets/opt/cake-berry-400.webp";
import cake_berry_800_avif from "@/assets/opt/cake-berry-800.avif";
import cake_berry_800_webp from "@/assets/opt/cake-berry-800.webp";
import cake_red_jpg from "@/assets/cake-red.jpg";
import cake_red_400_avif from "@/assets/opt/cake-red-400.avif";
import cake_red_400_webp from "@/assets/opt/cake-red-400.webp";
import cake_red_800_avif from "@/assets/opt/cake-red-800.avif";
import cake_red_800_webp from "@/assets/opt/cake-red-800.webp";
import cheesecake_jpg from "@/assets/cheesecake.jpg";
import cheesecake_400_avif from "@/assets/opt/cheesecake-400.avif";
import cheesecake_400_webp from "@/assets/opt/cheesecake-400.webp";
import cheesecake_800_avif from "@/assets/opt/cheesecake-800.avif";
import cheesecake_800_webp from "@/assets/opt/cheesecake-800.webp";
import cupcakes_jpg from "@/assets/cupcakes.jpg";
import cupcakes_400_avif from "@/assets/opt/cupcakes-400.avif";
import cupcakes_400_webp from "@/assets/opt/cupcakes-400.webp";
import cupcakes_800_avif from "@/assets/opt/cupcakes-800.avif";
import cupcakes_800_webp from "@/assets/opt/cupcakes-800.webp";
import cookies_jpg from "@/assets/cookies.jpg";
import cookies_400_avif from "@/assets/opt/cookies-400.avif";
import cookies_400_webp from "@/assets/opt/cookies-400.webp";
import cookies_800_avif from "@/assets/opt/cookies-800.avif";
import cookies_800_webp from "@/assets/opt/cookies-800.webp";
import brownies_jpg from "@/assets/brownies.jpg";
import brownies_400_avif from "@/assets/opt/brownies-400.avif";
import brownies_400_webp from "@/assets/opt/brownies-400.webp";
import brownies_800_avif from "@/assets/opt/brownies-800.avif";
import brownies_800_webp from "@/assets/opt/brownies-800.webp";
import knafeh_jpg from "@/assets/knafeh.jpg";
import knafeh_400_avif from "@/assets/opt/knafeh-400.avif";
import knafeh_400_webp from "@/assets/opt/knafeh-400.webp";
import knafeh_800_avif from "@/assets/opt/knafeh-800.avif";
import knafeh_800_webp from "@/assets/opt/knafeh-800.webp";
import baklava_jpg from "@/assets/baklava.jpg";
import baklava_400_avif from "@/assets/opt/baklava-400.avif";
import baklava_400_webp from "@/assets/opt/baklava-400.webp";
import baklava_800_avif from "@/assets/opt/baklava-800.avif";
import baklava_800_webp from "@/assets/opt/baklava-800.webp";
import mahalabia_jpg from "@/assets/mahalabia.jpg";
import mahalabia_400_avif from "@/assets/opt/mahalabia-400.avif";
import mahalabia_400_webp from "@/assets/opt/mahalabia-400.webp";
import mahalabia_800_avif from "@/assets/opt/mahalabia-800.avif";
import mahalabia_800_webp from "@/assets/opt/mahalabia-800.webp";
import builder_jpg from "@/assets/builder.jpg";
import builder_400_avif from "@/assets/opt/builder-400.avif";
import builder_400_webp from "@/assets/opt/builder-400.webp";
import builder_800_avif from "@/assets/opt/builder-800.avif";
import builder_800_webp from "@/assets/opt/builder-800.webp";
import hero_jpg from "@/assets/hero.jpg";
import hero_700_avif from "@/assets/opt/hero-700.avif";
import hero_700_webp from "@/assets/opt/hero-700.webp";
import hero_1400_avif from "@/assets/opt/hero-1400.avif";
import hero_1400_webp from "@/assets/opt/hero-1400.webp";

export type ImageSet = { src: string; avif: string; webp: string; width: number; height: number };

export const imageSets: Record<string, ImageSet> = {
  "cake-choc": {
    src: cake_choc_jpg,
    avif: `${cake_choc_400_avif} 400w, ${cake_choc_800_avif} 800w`,
    webp: `${cake_choc_400_webp} 400w, ${cake_choc_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "cake-berry": {
    src: cake_berry_jpg,
    avif: `${cake_berry_400_avif} 400w, ${cake_berry_800_avif} 800w`,
    webp: `${cake_berry_400_webp} 400w, ${cake_berry_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "cake-red": {
    src: cake_red_jpg,
    avif: `${cake_red_400_avif} 400w, ${cake_red_800_avif} 800w`,
    webp: `${cake_red_400_webp} 400w, ${cake_red_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "cheesecake": {
    src: cheesecake_jpg,
    avif: `${cheesecake_400_avif} 400w, ${cheesecake_800_avif} 800w`,
    webp: `${cheesecake_400_webp} 400w, ${cheesecake_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "cupcakes": {
    src: cupcakes_jpg,
    avif: `${cupcakes_400_avif} 400w, ${cupcakes_800_avif} 800w`,
    webp: `${cupcakes_400_webp} 400w, ${cupcakes_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "cookies": {
    src: cookies_jpg,
    avif: `${cookies_400_avif} 400w, ${cookies_800_avif} 800w`,
    webp: `${cookies_400_webp} 400w, ${cookies_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "brownies": {
    src: brownies_jpg,
    avif: `${brownies_400_avif} 400w, ${brownies_800_avif} 800w`,
    webp: `${brownies_400_webp} 400w, ${brownies_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "knafeh": {
    src: knafeh_jpg,
    avif: `${knafeh_400_avif} 400w, ${knafeh_800_avif} 800w`,
    webp: `${knafeh_400_webp} 400w, ${knafeh_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "baklava": {
    src: baklava_jpg,
    avif: `${baklava_400_avif} 400w, ${baklava_800_avif} 800w`,
    webp: `${baklava_400_webp} 400w, ${baklava_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "mahalabia": {
    src: mahalabia_jpg,
    avif: `${mahalabia_400_avif} 400w, ${mahalabia_800_avif} 800w`,
    webp: `${mahalabia_400_webp} 400w, ${mahalabia_800_webp} 800w`,
    width: 800,
    height: 800,
  },
  "builder": {
    src: builder_jpg,
    avif: `${builder_400_avif} 400w, ${builder_800_avif} 800w`,
    webp: `${builder_400_webp} 400w, ${builder_800_webp} 800w`,
    width: 1000,
    height: 1000,
  },
  "hero": {
    src: hero_jpg,
    avif: `${hero_700_avif} 700w, ${hero_1400_avif} 1400w`,
    webp: `${hero_700_webp} 700w, ${hero_1400_webp} 1400w`,
    width: 1400,
    height: 1000,
  },
};

export const images: Record<string, string> = Object.fromEntries(
  Object.entries(imageSets).map(([k, v]) => [k, v.src]),
);

export const heroImage = imageSets["hero"]!;
export const builderImage = imageSets["builder"]!;

