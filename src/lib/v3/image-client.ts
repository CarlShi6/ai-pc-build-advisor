import { NDJSON, readEvents } from "@/lib/v3/analysis-stream";
import type { ReadingSource } from "@/lib/v3/live-reading";
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

/**
 * Starts a streamed analysis. Every check before the provider accepts the photo (limits, daily
 * cap, human check, configuration) answers here as an ImageClientError, so the upload page can
 * show it; once this resolves, reading goes on in Studio (see live-reading.ts).
 */
export async function openImageAnalysisStream(
  image: Blob,
  signal?: AbortSignal,
  /** Dev only: hash of the original photo, so the dev server can save a local replay. */
  replayKey?: string,
  /** Cloudflare Turnstile token, when the human check is configured. */
  turnstileToken?: string,
): Promise<ReadingSource> {
  let response: Response;
  try {
    response = await fetch("/api/image-analyses", {
      method: "POST",
      headers: {
        "content-type": image.type,
        accept: NDJSON,
        ...(replayKey && { "x-aipc-replay-key": replayKey }),
        ...(turnstileToken && { "x-turnstile-token": turnstileToken }),
      },
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
  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null);
    const code = typeof body?.error?.code === "string" ? body.error.code : "ANALYSIS_FAILED";
    const message =
      typeof body?.error?.message === "string"
        ? body.error.message
        : "Image analysis is unavailable. Continue manually or retry.";
    throw new ImageClientError(message, code, response.status);
  }
  const stream = response.body;
  return async (onEvent, readSignal) => {
    const stop = () => void stream.cancel().catch(() => undefined);
    readSignal.addEventListener("abort", stop, { once: true });
    try {
      await readEvents(stream, onEvent);
    } finally {
      readSignal.removeEventListener("abort", stop);
    }
    if (readSignal.aborted) throw new Error("aborted");
  };
}
