import { createServerFn } from "@tanstack/react-start";
import { decodeValidatedImage } from "@/lib/image-validation";
import { publicError } from "@/lib/public-error";
import { logServerError } from "@/lib/server-log";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertRole, type StaffRoleName } from "@/lib/role-guard";

const BUCKET = "payment-receipts";
const SALES_ROLES: StaffRoleName[] = ["sales", "admin"];

export type ReceiptUploadRequest = {
  data_url: string;
};

/**
 * Uploads a customer payment remittance / CliQ voucher receipt to the secure
 * private "payment-receipts" storage bucket.
 * Restricted to authenticated staff (admin and sales roles).
 */
export const uploadPaymentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReceiptUploadRequest) => {
    if (!input?.data_url) {
      throw new Error("بيانات الصورة مطلوبة · Receipt image data is required");
    }
    const decoded = decodeValidatedImage(input.data_url, 800 * 1024);
    return decoded;
  })
  .handler(async ({ data, context }) => {
    await assertRole(context, SALES_ROLES);

    const now = new Date();
    const folder = now.toISOString().slice(0, 10);
    const filename = `${crypto.randomUUID()}.${data.ext}`;
    const objectPath = `${folder}/${filename}`;

    const { error: uploadError } = await context.supabase.storage
      .from(BUCKET)
      .upload(objectPath, data.binary, {
        contentType: data.contentType,
        upsert: false,
      });

    if (uploadError) {
      logServerError("receipt-upload.upload", uploadError, { objectPath });
      throw publicError("receipt-upload.upload", uploadError);
    }

    // Generate signed URL valid for 1 year (accessible by sales/admin)
    const { data: signResult, error: signError } = await context.supabase.storage
      .from(BUCKET)
      .createSignedUrl(objectPath, 60 * 60 * 24 * 365);

    if (signError || !signResult?.signedUrl) {
      logServerError("receipt-upload.signedUrl", signError, { objectPath });
      throw publicError("receipt-upload.signedUrl", signError);
    }

    return {
      url: signResult.signedUrl,
      path: objectPath,
    };
  });
