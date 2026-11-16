import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { convertToWebp } from "@/lib/image-webp";
import { uploadPaymentReceipt } from "@/lib/receipt-upload.functions";

/**
 * Compresses a selected payment receipt image to WebP and uploads it to private storage.
 */
export function useReceiptUpload(onUploaded: (url: string) => void | Promise<void>) {
  const [uploading, setUploading] = useState(false);
  const uploadFn = useServerFn(uploadPaymentReceipt);

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const converted = await convertToWebp(file, {
        kind: "cake",
        maxDimension: 800,
        quality: 0.8,
      });
      const res = await uploadFn({ data: { data_url: converted.dataUrl } });
      await onUploaded(res.url);
      toast.success("تم رفع إيصال كليك بنجاح");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع صورة الإيصال");
    } finally {
      setUploading(false);
    }
  };

  return { uploading, handleFile };
}
