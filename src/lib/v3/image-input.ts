export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 24_000_000;
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export class ImageInputError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "INVALID_IMAGE",
  ) {
    super(message);
    this.name = "ImageInputError";
  }
}

function ascii(bytes: Uint8Array, from: number, length: number) {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

function jpegDimensions(bytes: Uint8Array) {
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) break;
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) break;
    if (
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
        marker,
      )
    ) {
      if (length < 7) break;
      return {
        width: (bytes[offset + 5] << 8) | bytes[offset + 6],
        height: (bytes[offset + 3] << 8) | bytes[offset + 4],
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP")
    return null;
  const kind = ascii(bytes, 12, 4);
  if (kind === "VP8X") {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (kind === "VP8 " && ascii(bytes, 23, 3) === "\u009d\u0001*") {
    return {
      width: ((bytes[27] << 8) | bytes[26]) & 0x3fff,
      height: ((bytes[29] << 8) | bytes[28]) & 0x3fff,
    };
  }
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + (((bytes[22] & 0x3f) << 8) | bytes[21]),
      height: 1 + (((bytes[24] & 0x0f) << 10) | (bytes[23] << 2) | ((bytes[22] & 0xc0) >> 6)),
    };
  }
  return null;
}

export function inspectImage(bytes: Uint8Array, declaredMime: string) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES)
    throw new ImageInputError("Choose an image under 10 MB.", 413, "IMAGE_TOO_LARGE");
  let mime: ImageMime;
  let dimensions: { width: number; height: number } | null = null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    mime = "image/jpeg";
    dimensions = jpegDimensions(bytes);
  } else if (ascii(bytes, 0, 8) === "\u0089PNG\r\n\u001a\n") {
    mime = "image/png";
    if (bytes.length >= 24 && ascii(bytes, 12, 4) === "IHDR") {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      dimensions = { width: view.getUint32(16), height: view.getUint32(20) };
    }
  } else if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    mime = "image/webp";
    dimensions = webpDimensions(bytes);
  } else {
    throw new ImageInputError("This file is not a supported JPEG, PNG, or WebP image.", 415);
  }
  if (mime !== declaredMime)
    throw new ImageInputError("The image content does not match its file type.", 415);
  if (
    !dimensions ||
    dimensions.width < 16 ||
    dimensions.height < 16 ||
    dimensions.width * dimensions.height > MAX_IMAGE_PIXELS
  ) {
    throw new ImageInputError("The image dimensions are missing or too large.", 422);
  }
  return { mime, ...dimensions };
}

function joinBytes(parts: Uint8Array[]) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

export function stripImageMetadata(bytes: Uint8Array, mime: ImageMime) {
  if (mime === "image/jpeg") {
    const parts = [bytes.subarray(0, 2)];
    let offset = 2;
    while (offset + 4 <= bytes.length && bytes[offset] === 0xff) {
      const start = offset;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda) {
        parts.push(bytes.subarray(start));
        return joinBytes(parts);
      }
      if (marker === 0xd9) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      offset += length;
      if (marker !== 0xe1 && marker !== 0xed && marker !== 0xfe)
        parts.push(bytes.subarray(start, offset));
    }
    throw new ImageInputError("The JPEG file is incomplete.", 422);
  }
  if (mime === "image/png") {
    const parts = [bytes.subarray(0, 8)];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    let ended = false;
    let hasImage = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset);
      const end = offset + 12 + size;
      if (end > bytes.length) break;
      const kind = ascii(bytes, offset + 4, 4);
      if (kind === "IDAT") hasImage = true;
      if (!["eXIf", "iTXt", "tEXt", "zTXt"].includes(kind)) parts.push(bytes.subarray(offset, end));
      offset = end;
      if (kind === "IEND") {
        ended = true;
        break;
      }
    }
    if (!ended || !hasImage) throw new ImageInputError("The PNG file is incomplete.", 422);
    return joinBytes(parts);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length)
    throw new ImageInputError("The WebP file is incomplete.", 422);
  const parts = [bytes.subarray(0, 12)];
  let offset = 12;
  let hasImage = false;
  while (offset + 8 <= bytes.length) {
    const kind = ascii(bytes, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length) throw new ImageInputError("The WebP file is incomplete.", 422);
    if (kind === "ANIM") throw new ImageInputError("Animated WebP is not supported.", 415);
    if (kind === "VP8 " || kind === "VP8L") hasImage = true;
    if (kind !== "EXIF" && kind !== "XMP ") {
      const chunk = bytes.slice(offset, end);
      if (kind === "VP8X") chunk[8] &= ~0x0c;
      parts.push(chunk);
    }
    offset = end;
  }
  if (!hasImage || offset !== bytes.length)
    throw new ImageInputError("The WebP file is incomplete.", 422);
  const output = joinBytes(parts);
  new DataView(output.buffer).setUint32(4, output.length - 8, true);
  return output;
}

export async function readBoundedImage(request: Request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES)
    throw new ImageInputError("Choose an image under 10 MB.", 413, "IMAGE_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new ImageInputError("An image is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageInputError("Choose an image under 10 MB.", 413, "IMAGE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes, ...inspectImage(bytes, request.headers.get("content-type") ?? "") };
}
