/**
 * Resumable File Upload Client for Delish Cake & Bake
 * Powered by tus-js-client (https://github.com/tus/tus-js-client)
 * Integrates directly with Supabase Storage Resumable Upload protocol.
 */

import * as tus from "tus-js-client";

export interface ResumableUploadConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  bucketName: string;
  fileName: string;
  file: File | Blob | Buffer;
  onProgress?: (bytesUploaded: number, bytesTotal: number, percent: number) => void;
  onSuccess?: (uploadUrl: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Creates a resumable TUS upload instance tailored for Supabase Storage.
 */
export function createResumableUpload(config: ResumableUploadConfig): tus.Upload {
  const {
    supabaseUrl,
    supabaseAnonKey,
    bucketName,
    fileName,
    file,
    onProgress,
    onSuccess,
    onError,
  } = config;

  // Supabase Resumable Storage endpoint: /storage/v1/upload/resumable
  const cleanUrl = supabaseUrl.replace(/\/$/, "");
  const endpoint = `${cleanUrl}/storage/v1/upload/resumable`;

  const upload = new tus.Upload(file, {
    endpoint,
    retryDelays: [0, 1000, 3000, 5000],
    headers: {
      authorization: `Bearer ${supabaseAnonKey}`,
      apikey: supabaseAnonKey,
      "x-upsert": "true", // Overwrite existing with same name if retrying
    },
    uploadDataDuringCreation: true,
    removeFingerprintOnSuccess: true,
    metadata: {
      bucketName,
      objectName: fileName,
      contentType: "image/webp",
      cacheControl: "3600",
    },
    chunkSize: 6 * 1024 * 1024, // 6MB chunk size recommended for Supabase
    onError: (err) => {
      if (onError) onError(err);
    },
    onProgress: (bytesUploaded, bytesTotal) => {
      const percent = bytesTotal > 0 ? Math.round((bytesUploaded / bytesTotal) * 100) : 0;
      if (onProgress) onProgress(bytesUploaded, bytesTotal, percent);
    },
    onSuccess: () => {
      const publicUrl = `${cleanUrl}/storage/v1/object/public/${bucketName}/${fileName}`;
      if (onSuccess) onSuccess(publicUrl);
    },
  });

  return upload;
}
