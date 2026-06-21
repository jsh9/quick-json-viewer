import {
  BYTES_PER_MIB,
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  MIN_PREVIEW_LINES,
  NO_PREVIEW_LINES_LIMIT,
  isPreviewLinesWithinLimit
} from '../shared/settings';

export {
  BYTES_PER_MIB,
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  MIN_PREVIEW_LINES,
  NO_PREVIEW_LINES_LIMIT
} from '../shared/settings';

export interface ViewerSettings {
  readonly largeFileThresholdMb: number;
  readonly previewLines: number;
  readonly maxAllowablePreviewLines: number;
}

export function normalizeViewerSettings(input: {
  readonly largeFileThresholdMb?: unknown;
  readonly previewLines?: unknown;
  readonly maxAllowablePreviewLines?: unknown;
}): ViewerSettings {
  const maxAllowablePreviewLines = normalizeMaxAllowablePreviewLines(
    input.maxAllowablePreviewLines
  );
  const previewLines = normalizeInteger(
    input.previewLines,
    DEFAULT_PREVIEW_LINES,
    MIN_PREVIEW_LINES
  );

  return {
    largeFileThresholdMb: normalizeNumber(
      input.largeFileThresholdMb,
      DEFAULT_LARGE_FILE_THRESHOLD_MB,
      0
    ),
    previewLines: isPreviewLinesWithinLimit(
      previewLines,
      maxAllowablePreviewLines
    )
      ? previewLines
      : maxAllowablePreviewLines,
    maxAllowablePreviewLines
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
  minimum: number
): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < minimum
  ) {
    return fallback;
  }

  return value;
}

function normalizeMaxAllowablePreviewLines(value: unknown): number {
  if (value === NO_PREVIEW_LINES_LIMIT) {
    return NO_PREVIEW_LINES_LIMIT;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES;
  }

  return value;
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
