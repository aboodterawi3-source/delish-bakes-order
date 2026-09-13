import { createServerFn } from "@tanstack/react-start";

const BUCKET = "order-designs";
const MAX_BYTES = 2_500_000;
const DATA_URL = /^data:image\/(webp|png|jpe?g);base64,([A-Za-z0-9+/=]+)$/;
/** Five years: staff must still be able to open old reference photos. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5;

export type DesignUploadRequest = { data_url: string };

/**
 * Stores a customer reference photo (already converted to WebP in the browser)
 * in private Cloud storage and returns a long-lived signed URL for staff views.
 */
export const uploadDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: DesignUploadRequest) => {
    const raw = typeof input?.data_url === "string" ? input.data_url.trim() : "";
    const match = DATA_URL.exec(raw);
    if (!match) throw new Error("صيغة صورة غير مدعومة · Unsupported image format");
    const base64 = match[2]!;
    const bytes = Math.floor(base64.length * 0.75);
    if (bytes > MAX_BYTES) throw new Error("حجم الصورة كبير جداً · Image is too large");
    return { ext: match[1] === "jpeg" ? "jpg" : match[1]!, base64 };
  })
  .handler(async ({ data }) => {
    const binary = Uint8Array.from(atob(data.base64), (char) => char.charCodeAt(0));
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${data.ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, binary, { contentType: `image/${data.ext === "jpg" ? "jpeg" : data.ext}`, upsert: false });
    if (error) throw new Error(error.message);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "تعذّر إنشاء رابط الصورة · Could not create the image link");
    }

    return { url: signed.signedUrl, path };
  });
