import { useDismissable } from "@/lib/a11y";
import { Download, X } from "lucide-react";

interface ImageLightboxProps {
  src: string | null;
  onClose: () => void;
  alt?: string;
  onDownload?: ((src: string) => void) | undefined;
}

/** Shared fullscreen lightbox overlay for previewing design photos and receipts. */
export function ImageLightbox({
  src,
  onClose,
  alt = "معاينة الصورة",
  onDownload,
}: ImageLightboxProps) {
  useDismissable(Boolean(src), onClose);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <div className="mt-3 flex justify-center gap-2">
          {onDownload && (
            <button
              type="button"
              onClick={() => onDownload(src)}
              className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-900 shadow hover:bg-slate-100"
            >
              <Download className="h-3.5 w-3.5" /> تحميل الصورة
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white backdrop-blur hover:bg-white/25"
          >
            <X className="h-3.5 w-3.5" /> إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
