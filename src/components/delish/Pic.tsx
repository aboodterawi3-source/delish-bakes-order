import { memo } from "react";
import type { ImageSet } from "@/lib/images";

type Props = {
  set: ImageSet;
  alt: string;
  className?: string;
  sizes: string;
  /** true only for the LCP hero image */
  priority?: boolean;
};

/**
 * Responsive picture element: AVIF -> WebP -> JPEG, with intrinsic
 * width/height so the browser reserves space (no layout shift).
 */
function PicBase({ set, alt, className, sizes, priority = false }: Props) {
  return (
    <picture>
      <source type="image/avif" srcSet={set.avif} sizes={sizes} />
      <source type="image/webp" srcSet={set.webp} sizes={sizes} />
      <img
        src={set.src}
        alt={alt}
        width={set.width}
        height={set.height}
        sizes={sizes}
        className={className}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        {...(priority ? { fetchPriority: "high" as const } : {})}
      />
    </picture>
  );
}

export const Pic = memo(PicBase);
