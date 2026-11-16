import { Download } from "lucide-react";
import { parseDesignImageUrls } from "@/lib/utils";

interface DesignGalleryProps {
  designImageUrl: string | null | undefined;
  onZoom: (url: string) => void;
  onDownload?: ((url: string, index: number) => void) | undefined;
  title?: string;
  subtitle?: string;
}

/** Displays customer design reference thumbnails with lightbox zoom and optional download. */
export function DesignGallery({
  designImageUrl,
  onZoom,
  onDownload,
  title,
  subtitle,
}: DesignGalleryProps) {
  const urls = parseDesignImageUrls(designImageUrl);
  if (urls.length === 0) return null;

  const resolvedTitle =
    title ?? (urls.length > 1 ? `صور التصميم المرفقة (${urls.length}):` : "صورة التصميم المرفقة:");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-xs font-bold text-muted-foreground">{resolvedTitle}</span>
        {subtitle && (
          <span className="text-[11px] font-bold text-muted-foreground">{subtitle}</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {urls.map((imgUrl, idx) => (
          <div
            key={`${imgUrl}-${idx}`}
            className="relative overflow-hidden rounded-xl border border-border bg-card shadow-2xs"
          >
            <img
              src={imgUrl}
              alt={`Design Reference ${idx + 1}`}
              loading="lazy"
              onClick={() => onZoom(imgUrl)}
              className="h-28 w-28 cursor-pointer object-cover transition-opacity hover:opacity-90"
            />
            {onDownload && (
              <button
                type="button"
                onClick={() => onDownload(imgUrl, idx)}
                className="absolute bottom-1.5 left-1.5 grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-border bg-white/95 text-foreground shadow-xs hover:bg-secondary"
                title="تنزيل للطباعة"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
