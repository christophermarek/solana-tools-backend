import * as logging from "../../utils/logging.ts";

const TAG = "validate-image";

export interface ImageValidationResult {
  blob: Blob;
  type: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export type ImageValidationError =
  | { type: "INVALID_FORMAT"; message: string }
  | { type: "INVALID_TYPE"; message: string }
  | { type: "FILE_TOO_LARGE"; message: string }
  | { type: "INVALID_DIMENSIONS"; message: string }
  | { type: "DECODE_ERROR"; message: string };

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MIN_DIMENSION = 1000;

function getImageDimensionsFromPNG(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 24) return null;

  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E &&
    bytes[3] === 0x47;
  if (!isPNG) return null;

  const width = (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) |
    bytes[19];
  const height = (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) |
    bytes[23];

  return { width, height };
}

function getImageDimensionsFromJPEG(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 2) return null;

  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8;
  if (!isJPEG) return null;

  let offset = 2;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xFF) break;

    const marker = bytes[offset + 1];

    if (marker === 0xC0 || marker === 0xC2) {
      if (offset + 9 > bytes.length) return null;
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return { width, height };
    }

    if (marker === 0xD8 || marker === 0xD9) {
      offset += 2;
      continue;
    }

    if (offset + 3 > bytes.length) break;
    const segmentLength = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + segmentLength;
  }

  return null;
}

function getImageDimensionsFromGIF(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (bytes.length < 10) return null;

  const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  if (!isGIF) return null;

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);

  return { width, height };
}

function getImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): { width: number; height: number } | null {
  if (mimeType === "image/png") {
    return getImageDimensionsFromPNG(bytes);
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return getImageDimensionsFromJPEG(bytes);
  } else if (mimeType === "image/gif") {
    return getImageDimensionsFromGIF(bytes);
  }
  return null;
}

export function validateImageForPumpFun(
  base64Data: string,
  requestId = "system",
): [ImageValidationResult, null] | [null, ImageValidationError] {
  try {
    let imageData = base64Data;
    let imageType = "image/png";

    if (base64Data.includes(",")) {
      const parts = base64Data.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) {
        imageType = mimeMatch[1];
      }
      imageData = parts[1];
    } else {
      const header = base64Data.substring(0, 10);
      if (header.startsWith("iVBORw0KGg")) {
        imageType = "image/png";
      } else if (header.startsWith("/9j/")) {
        imageType = "image/jpeg";
      } else if (header.startsWith("R0lGOD")) {
        imageType = "image/gif";
      }
    }

    if (!ALLOWED_TYPES.includes(imageType)) {
      return [
        null,
        {
          type: "INVALID_TYPE",
          message:
            `Invalid image type '${imageType}'. Supported formats: .jpg, .png, .gif`,
        },
      ];
    }

    let binaryString: string;
    try {
      binaryString = atob(imageData);
    } catch {
      return [
        null,
        {
          type: "INVALID_FORMAT",
          message: "Invalid base64 format",
        },
      ];
    }

    const fileSizeBytes = binaryString.length;

    if (fileSizeBytes > MAX_FILE_SIZE) {
      return [
        null,
        {
          type: "FILE_TOO_LARGE",
          message: `Image file is too large (${
            (fileSizeBytes / 1024 / 1024).toFixed(2)
          }MB). Maximum allowed size is 15MB`,
        },
      ];
    }

    const bytes = new Uint8Array(fileSizeBytes);
    for (let i = 0; i < fileSizeBytes; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const dimensions = getImageDimensions(bytes, imageType);
    if (!dimensions) {
      return [
        null,
        {
          type: "DECODE_ERROR",
          message: `Failed to decode image dimensions for type '${imageType}'`,
        },
      ];
    }

    const { width, height } = dimensions;

    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      return [
        null,
        {
          type: "INVALID_DIMENSIONS",
          message:
            `Image dimensions too small (${width}x${height}px). Minimum required is ${MIN_DIMENSION}x${MIN_DIMENSION}px`,
        },
      ];
    }

    const aspectRatio = width / height;
    if (aspectRatio < 0.9 || aspectRatio > 1.1) {
      return [
        null,
        {
          type: "INVALID_DIMENSIONS",
          message:
            `Image aspect ratio must be 1:1 (square). Current dimensions: ${width}x${height}px (ratio: ${
              aspectRatio.toFixed(2)
            }:1)`,
        },
      ];
    }

    const imageBlob = new Blob([bytes], { type: imageType });

    logging.info(requestId, `${TAG}: Image validated successfully`, {
      type: imageType,
      width,
      height,
      sizeKB: (fileSizeBytes / 1024).toFixed(2),
      aspectRatio: aspectRatio.toFixed(2),
    });

    return [
      {
        blob: imageBlob,
        type: imageType,
        width,
        height,
        sizeBytes: fileSizeBytes,
      },
      null,
    ];
  } catch (error) {
    logging.error(requestId, `${TAG}: Failed to validate image`, error);
    return [
      null,
      {
        type: "DECODE_ERROR",
        message: error instanceof Error
          ? error.message
          : "Unknown error occurred during image validation",
      },
    ];
  }
}
