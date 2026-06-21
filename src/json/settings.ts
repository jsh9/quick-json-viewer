import {
  BYTES_PER_MIB,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  MAX_PREVIEW_LINES,
  MIN_PREVIEW_LINES
} from '../shared/settings';

export {
  BYTES_PER_MIB,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  MAX_PREVIEW_LINES,
  MIN_PREVIEW_LINES
} from '../shared/settings';

export interface ViewerSettings {
  readonly largeFileThresholdMb: number;
  readonly previewLines: number;
}

export function normalizeViewerSettings(input: {
  readonly largeFileThresholdMb?: unknown;
  readonly previewLines?: unknown;
}): ViewerSettings {
  return {
    largeFileThresholdMb: normalizeNumber(
      input.largeFileThresholdMb,
      DEFAULT_LARGE_FILE_THRESHOLD_MB,
      0
    ),
    previewLines: normalizeInteger(
      input.previewLines,
      DEFAULT_PREVIEW_LINES,
      MIN_PREVIEW_LINES,
      MAX_PREVIEW_LINES
    )
  };
}

export function getThresholdBytes(largeFileThresholdMb: number): number {
  return largeFileThresholdMb * BYTES_PER_MIB;
}

export function shouldPreviewFile(
  fileSizeBytes: number,
  settings: ViewerSettings
): boolean {
  return fileSizeBytes > getThresholdBytes(settings.largeFileThresholdMb);
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    return fallback;
  }

  return Math.min(value, maximum);
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  minimum: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    return fallback;
  }

  return value;
}
