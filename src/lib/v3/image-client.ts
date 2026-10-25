import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { ImageInputError, inspectImage, MAX_IMAGE_BYTES } from "@/lib/v3/image-input";

export class ImageClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "ImageClientError";
  }
}

export async function prepareImageForAnalysis(file: File): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES)
    throw new ImageInputError("Choose an image under 10 MB.", 413, "IMAGE_TOO_LARGE");
  inspectImage(new Uint8Array(await file.arrayBuffer()), file.type);
  if (typeof createImageBitmap !== "function")
    throw new ImageClientError(
      "This browser cannot prepare the image. Continue manually.",
      "UNSUPPORTED_BROWSER",
    );
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImageClientError(
      "This image could not be decoded. Choose another file.",
      "UNSUPPORTED_IMAGE",
    );
  }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new ImageClientError("This browser cannot prepare the image.", "UNSUPPORTED_BROWSER");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    if (!blob || blob.size > MAX_IMAGE_BYTES)
      throw new ImageClientError(
        "This image could not be prepared. Choose another file.",
        "ENCODE_FAILED",
      );
    return blob;
  } finally {
    bitmap.close();
  }
}

export async function requestImageAnalysis(
  image: Blob,
  signal?: AbortSignal,
): Promise<ImageAnalysisResult> {
  let response: Response;
  try {
    response = await fetch("/api/image-analyses", {
      method: "POST",
      headers: { "content-type": image.type },
      body: image,
      cache: "no-store",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ImageClientError(
      "Image analysis could not connect. Retry or continue manually.",
      "NETWORK_ERROR",
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : "ANALYSIS_FAILED";
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : "Image analysis is unavailable. Continue manually or retry.";
    throw new ImageClientError(message, code, response.status);
  }
  if (body?.status !== "ready" || !Array.isArray(body.observations))
    throw new ImageClientError("Image analysis returned an invalid result.", "INVALID_ANALYSIS");
  return body as ImageAnalysisResult;
}
