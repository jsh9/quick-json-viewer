export const DEFAULT_LARGE_FILE_THRESHOLD_MB = 10;
export const DEFAULT_PREVIEW_LINES = 100;
export const MIN_PREVIEW_LINES = 1;
export const NO_PREVIEW_LINES_LIMIT = -1;
export const DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES = 10_000;
export const BYTES_PER_MIB = 1024 * 1024;

export const PREVIEW_LINES_ERROR_MESSAGE =
  'Preview line count must be a positive integer.';

export function isPreviewLinesWithinLimit(
  previewLines: number,
  maxAllowablePreviewLines: number
): boolean {
  return (
    maxAllowablePreviewLines === NO_PREVIEW_LINES_LIMIT ||
    previewLines <= maxAllowablePreviewLines
  );
}

export function getPreviewLinesErrorMessage(
  maxAllowablePreviewLines: number
): string {
  if (maxAllowablePreviewLines === NO_PREVIEW_LINES_LIMIT) {
    return PREVIEW_LINES_ERROR_MESSAGE;
  }

  return (
    'Preview line count must be an integer between 1 and ' +
    maxAllowablePreviewLines.toLocaleString('en-US') +
    '. To raise this limit, set "quickJsonViewer.maxAllowablePreviewLines" ' +
    'in VS Code User Settings (JSON). Set to "-1" to indicate no limit.'
  );
}
