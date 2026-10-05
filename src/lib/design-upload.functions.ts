import { createServerFn } from "@tanstack/react-start";
import { decodeValidatedImage } from "@/lib/image-validation";
import { publicError } from "@/lib/public-error";
import { logServerError } from "@/lib/server-log";

const BUCKET = "order-designs";
/** Five years: staff must still be able to open old reference photos. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 5;

/** The only shape uploadDesignImage ever produces: YYYY-MM-DD/<uuid>.<ext>. */
const DESIGN_PATH =
  /^\d{4}-\d{2}-\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:webp|jpg|png)$/i;
const OBJECT_URL_PATH =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/order-designs\/([^?#]+)/;

export type DesignUploadRequest = {
  data_url: string;
  previous_path?: string | null;
  previous_url?: string | null;
  previous_deleteToken?: string | null;
};

async function signPath(path: string): Promise<string> {
  const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_SERVICE_KEY"];
  if (!secret) throw new Error("Service role key is missing");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret.slice(0, 32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(path));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolves a client-supplied path/url to a safe bucket path, or null. Anything that
 * does not match our own generated shape (traversal, other folders) is ignored.
 */
function resolveDesignPath(path?: string | null, url?: string | null): string | null {
  let candidate = (path ?? "").trim();
  if (!candidate && url) {
    const match = OBJECT_URL_PATH.exec(url);
    if (match?.[1]) {
      try {
        candidate = decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }
  return DESIGN_PATH.test(candidate) ? candidate : null;
}

/**
 * Photos already attached to an order must never be deletable from the public
 * endpoint. Fails closed: on a lookup error we treat the photo as attached.
 */
async function isAttachedToOrder(
  admin: Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"],
  path: string,
): Promise<boolean> {
  // `path` matched DESIGN_PATH, so it contains no LIKE wildcards (% or _).
  const { count, error } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .like("design_image_url", `%/order-designs/${path}%`);
  if (error) {
    logServerError("design-upload.attachedCheck", error);
    return true;
  }
  return (count ?? 0) > 0;
}

async function removeDesignPhoto(path: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (await isAttachedToOrder(supabaseAdmin, path)) return;
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (error) logServerError("design-upload.remove", error, { path });
}

/**
 * Stores a customer reference photo (already converted to WebP in the browser)
 * in private Cloud storage and returns a long-lived signed URL for staff views.
 * A superseded photo is deleted only when it matches our generated path shape
 * and is not attached to any order.
 */
export const uploadDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: DesignUploadRequest) => {
    const decoded = decodeValidatedImage(input?.data_url, 400 * 1024);
    return {
      ...decoded,
      previous_path: input?.previous_path ?? null,
      previous_url: input?.previous_url ?? null,
      previous_deleteToken: input?.previous_deleteToken ?? null,
    };
  })
  .handler(async ({ data }) => {
    // 15 uploads / 10 min / client: stops storage-filling abuse from the public form.
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    enforceRateLimit("design-upload", 15, 10 * 60_000);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validated, order-safe cleanup of the replaced photo (was: arbitrary path deletion).
    const oldPath = resolveDesignPath(data.previous_path, data.previous_url);
    if (oldPath && data.previous_deleteToken === await signPath(oldPath)) {
      await removeDesignPhoto(oldPath);
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

    const deleteToken = await signPath(path);
    return { url: signed.signedUrl, path, deleteToken };
  });

/**
 * Removes an unattached design photo when the customer discards their preview.
 * Only paths in our own generated shape that are not linked to an order are deleted.
 */
export const deleteDesignImage = createServerFn({ method: "POST" })
  .inputValidator((input: { path?: string | null; url?: string | null; deleteToken?: string | null }) => ({
    path: typeof input?.path === "string" ? input.path : null,
    url: typeof input?.url === "string" && input.url.length <= 2500 ? input.url : null,
    deleteToken: typeof input?.deleteToken === "string" ? input.deleteToken : null,
  }))
  .handler(async ({ data }) => {
    const { enforceRateLimit } = await import("@/lib/rate-limit");
    enforceRateLimit("design-delete", 30, 10 * 60_000);

    const target = resolveDesignPath(data.path, data.url);
    if (target && data.deleteToken === await signPath(target)) {
      await removeDesignPhoto(target);
    }
    // Always the same answer so the endpoint cannot be used to probe which files exist.
    return { ok: true };
  });
