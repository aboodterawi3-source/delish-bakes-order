import { createServerFn } from "@tanstack/react-start";
import { decodeValidatedImage } from "@/lib/image-validation";

const BUCKET = "order-designs";
/** Five years: staff must still be able to open old reference photos. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5;

export type DesignUploadRequest = { data_url: string };

/**
 * Stores a customer reference photo (already converted to WebP in the browser)
 * in private Cloud storage and returns a long-lived signed URL for staff views.
 */
export const uploadDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: DesignUploadRequest) => decodeValidatedImage(input?.data_url))
  .handler(async ({ data }) => {
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${data.ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, data.binary, { contentType: data.contentType, upsert: false });
    if (error) throw new Error(error.message);

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signError || !signed?.signedUrl) {
      throw new Error(signError?.message ?? "تعذّر إنشاء رابط الصورة · Could not create the image link");
    }

    return { url: signed.signedUrl, path };
  });
