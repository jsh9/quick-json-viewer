import {
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  PREVIEW_LINES_ERROR_MESSAGE,
  getPreviewLinesErrorMessage,
  isPreviewLinesWithinLimit
} from '../../shared/settings';

export {
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  PREVIEW_LINES_ERROR_MESSAGE,
  getPreviewLinesErrorMessage
};

export type ViewState = 'loading' | 'previewLoading' | 'ready' | 'error';

export type LineCountState = 'counting' | 'ready' | 'unavailable';

export interface NormalizedLineCountProgress {
  readonly percent: number;
  readonly lineCount: number | null;
}

interface LineCountProgress {
  readonly percent?: number;
  readonly lineCount?: number;
}

export interface JsonPreviewLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly truncated: boolean;
  readonly originalLength: number;
}

export interface JsonPreview {
  readonly lines: JsonPreviewLine[];
  readonly loadedLineCount: number;
  readonly displayLimit: number;
  readonly truncatedLineCount: number;
  readonly truncatedByLineLimit: boolean;
}

export interface JsonDataState {
  readonly fileName: string;
  readonly fileSize: string;
  readonly fileSizeBytes: number;
  readonly lastModified: string;
  readonly largeFileThresholdMb: number;
  readonly thresholdBytes: number;
  readonly previewLines: number;
  readonly maxAllowablePreviewLines: number;
  lineCount: number | null;
  lineCountState: LineCountState;
  lineCountProgress: NormalizedLineCountProgress | null;
  readonly preview: JsonPreview;
}

export type JsonDataPayload = Omit<
  JsonDataState,
  'lineCountState' | 'lineCountProgress'
>;

export type PreviewLoadPayload = Omit<JsonDataPayload, 'preview'>;

export type ExtensionMessage =
  | { readonly type: 'loading' }
  | { readonly type: 'previewLoadStart'; readonly payload: PreviewLoadPayload }
  | { readonly type: 'data'; readonly payload: JsonDataPayload }
  | { readonly type: 'lineCount'; readonly lineCount: number }
  | { readonly type: 'lineCountProgress'; readonly payload: unknown }
  | { readonly type: 'lineCountError'; readonly message?: string }
  | { readonly type: 'previewLinesError'; readonly message?: string }
  | { readonly type: 'error'; readonly message?: string };

export type WebviewPostMessage =
  | { readonly type: 'ready' }
  | { readonly type: 'showRawJson' }
  | { readonly type: 'updatePreviewLines'; readonly value: number };

export const EXTENSION_MESSAGE_TYPES = [
  'loading',
  'previewLoadStart',
  'data',
  'lineCount',
  'lineCountProgress',
  'lineCountError',
  'previewLinesError',
  'error'
] as const;

export const WEBVIEW_POSTED_MESSAGE_TYPES = [
  'ready',
  'showRawJson',
  'updatePreviewLines'
] as const;

export type NumericSubmission =
  | {
      readonly kind: 'changed';
      readonly value: number;
      readonly submittedValue: string;
    }
  | { readonly kind: 'unchanged'; readonly value: number }
  | { readonly kind: 'invalid'; readonly message: string };

export function getPreviewLinesSubmission(
  rawInput: string,
  lastSubmittedValue: string,
  maxAllowablePreviewLines: number
): NumericSubmission {
  const rawValue = rawInput.trim();
  if (rawValue === '') {
    return {
      kind: 'invalid',
      message: getPreviewLinesErrorMessage(maxAllowablePreviewLines)
    };
  }

  const value = Number(rawValue);
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    !isPreviewLinesWithinLimit(value, maxAllowablePreviewLines)
  ) {
    return {
      kind: 'invalid',
      message: getPreviewLinesErrorMessage(maxAllowablePreviewLines)
    };
  }

  const submittedValue = String(value);
  if (typeof submittedValue !== 'string') {
    return {
      kind: 'invalid',
      message: getPreviewLinesErrorMessage(maxAllowablePreviewLines)
    };
  }

  return submittedValue === lastSubmittedValue
    ? { kind: 'unchanged', value }
    : { kind: 'changed', value, submittedValue };
}

export function withLineCountState(payload: JsonDataPayload): JsonDataState {
  return {
    ...payload,
    lineCountState: payload.lineCount === null ? 'counting' : 'ready',
    lineCountProgress: null
  };
}

export function normalizeLineCountProgress(
  payload: unknown
): NormalizedLineCountProgress | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const progress = payload as LineCountProgress;
  if (
    typeof progress.percent !== 'number' ||
    !Number.isFinite(progress.percent)
  ) {
    return null;
  }

  return {
    percent: progress.percent,
    lineCount:
      typeof progress.lineCount === 'number' && progress.lineCount > 0
        ? progress.lineCount
        : null
  };
}
