import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/image-validation";

interface CliQReceiptUploadBoxProps {
  receiptUrl: string | null;
  uploading: boolean;
  onUploadFile: (file: File) => void;
  onPreview: (url: string) => void;
  title?: string;
  emptyLabel?: string;
  compact?: boolean;
}

/** Shared CliQ transfer receipt preview + file upload control for staff payment views. */
export function CliQReceiptUploadBox({
  receiptUrl,
  uploading,
  onUploadFile,
  onPreview,
  title = "صورة إشعار حوالة كليك",
  emptyLabel = "📸 إرفاق صورة إشعار حوالة كليك",
  compact = false,
}: CliQReceiptUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          if (file) onUploadFile(file);
        }}
      />

      {receiptUrl ? (
        <div
          className={`flex items-center justify-between gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 p-2 dark:border-emerald-800/40 dark:bg-emerald-950/20`}
        >
          <div className="flex items-center gap-2.5">
            <img
              src={receiptUrl}
              alt={title}
              onClick={() => onPreview(receiptUrl)}
              className={`${compact ? "h-12 w-12" : "h-14 w-14"} shrink-0 cursor-pointer rounded-lg border border-border object-cover transition hover:opacity-90`}
              title="اضغط لفتح الصورة"
            />
            <div className={compact ? "text-[11px]" : "text-xs"}>
              {compact && (
                <p className="font-black text-emerald-800 dark:text-emerald-300">💳 {title}</p>
              )}
              <button
                type="button"
                onClick={() => onPreview(receiptUrl)}
                className="cursor-pointer font-bold text-primary hover:underline"
              >
                {compact ? "عرض وتكبير 🔍" : "عرض الصورة 🔍"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="cursor-pointer rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-secondary"
          >
            {uploading ? "جاري الرفع..." : compact ? "تغيير" : "تغيير الصورة"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-amber-400 bg-amber-50/50 px-3 font-bold text-amber-900 hover:bg-amber-50 dark:bg-amber-950/20 dark:text-amber-200 ${compact ? "min-h-9 text-[11px]" : "min-h-10 text-xs"}`}
        >
          {uploading ? (
            <Loader2 className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} animate-spin`} />
          ) : (
            <Camera className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          )}
          <span>{uploading ? "جاري رفع صورة الحوالة..." : emptyLabel}</span>
        </button>
      )}
    </div>
  );
}
