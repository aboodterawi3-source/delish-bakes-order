import { createServerFn } from "@tanstack/react-start";
import { decodeValidatedImage } from "@/lib/image-validation";
import { publicError } from "@/lib/public-error";

const BUCKET = "order-designs";
/** Five years: staff must still be able to open old reference photos. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5;

export type DesignUploadRequest = {
  data_url: string;
  previous_path?: string | null;
  previous_url?: string | null;
};

/**
 * Stores a customer reference photo (already converted to WebP in the browser)
 * in private Cloud storage and returns a long-lived signed URL for staff views.
 * If previous_url or previous_path is provided, the superseded image is deleted
 * to prevent orphaned files in Supabase Storage.
 */
export const uploadDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: DesignUploadRequest) => {
    const decoded = decodeValidatedImage(input?.data_url, 400 * 1024);
    return {
      ...decoded,
      previous_path: input?.previous_path ?? null,
      previous_url: input?.previous_url ?? null,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clean up replaced photo from the same session to avoid orphaned storage files
    let oldPath = data.previous_path?.trim() || "";
    if (!oldPath && data.previous_url) {
      const match = data.previous_url.match(/order-designs\/([^?]+)/);
      if (match) {
        oldPath = decodeURIComponent(match[1]);
      }
    }
    if (oldPath) {
      try {
        await supabaseAdmin.storage.from(BUCKET).remove([oldPath]);
      } catch (err) {
        console.warn("[Storage] failed to delete previous design photo:", err);
      }
    }

    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${data.ext}`;

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, data.binary, { contentType: data.contentType, upsert: false });
    if (error)
      throw publicError(
        "design-upload.store",
        error,
        "تعذّر رفع الصورة · Could not upload the photo",
      );

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) {
      throw publicError(
        "design-upload.sign",
        signError,
        "تعذّر إنشاء رابط الصورة · Could not create the image link",
      );
    }

    return { url: signed.signedUrl, path };
  });

/**
 * Explicitly removes an uploaded design photo from Supabase Storage when
 * the customer clears or discards their custom design preview.
 */
export const deleteDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: { path?: string | null; url?: string | null }) => input)
  .handler(async ({ data }) => {
    let targetPath = data?.path?.trim() || "";
    if (!targetPath && data?.url) {
      const match = data.url.match(/order-designs\/([^?]+)/);
      if (match) {
        targetPath = decodeURIComponent(match[1]);
      }
    }
    if (targetPath) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.storage.from(BUCKET).remove([targetPath]);
      } catch (err) {
        console.warn("[Storage] failed to delete design photo:", err);
      }
    }
    return { ok: true };
  });

