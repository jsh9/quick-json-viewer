import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  EXTENSION_MESSAGE_TYPES,
  PREVIEW_LINES_ERROR_MESSAGE,
  WEBVIEW_POSTED_MESSAGE_TYPES,
  getPreviewLinesErrorMessage,
  getPreviewLinesSubmission,
  normalizeLineCountProgress,
  withLineCountState
} from '../../../src/webview/lib/protocol';

test('webview preview-line validation rejects invalid input and de-duplicates submitted values', () => {
  assert.deepEqual(getPreviewLinesSubmission('', '', 10000), {
    kind: 'invalid',
    message:
      'Preview line count must be an integer between 1 and 10,000. To raise this limit, set "quickJsonViewer.maxAllowablePreviewLines" in VS Code User Settings (JSON). Set to "-1" to indicate no limit.'
  });
  assert.equal(getPreviewLinesSubmission('-1', '', 10000).kind, 'invalid');
  assert.equal(getPreviewLinesSubmission('1.5', '', 10000).kind, 'invalid');
  assert.equal(getPreviewLinesSubmission('10001', '', 10000).kind, 'invalid');
  assert.deepEqual(getPreviewLinesSubmission('10001', '', 20000), {
    kind: 'changed',
    value: 10001,
    submittedValue: '10001'
  });
  assert.deepEqual(getPreviewLinesSubmission('25000', '', -1), {
    kind: 'changed',
    value: 25000,
    submittedValue: '25000'
  });
  assert.deepEqual(getPreviewLinesSubmission('007', '', 10000), {
    kind: 'changed',
    value: 7,
    submittedValue: '7'
  });
  assert.deepEqual(getPreviewLinesSubmission('7', '7', 10000), {
    kind: 'unchanged',
    value: 7
  });
});

test('webview protocol constants list expected message types', () => {
  assert.equal(DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES, 10000);
  assert.equal(
    PREVIEW_LINES_ERROR_MESSAGE,
    'Preview line count must be a positive integer.'
  );
  assert.equal(
    getPreviewLinesErrorMessage(-1),
    'Preview line count must be a positive integer.'
  );
  assert.deepEqual(EXTENSION_MESSAGE_TYPES, [
    'loading',
    'previewLoadStart',
    'data',
    'lineCount',
    'lineCountProgress',
    'lineCountError',
    'previewLinesError',
    'error'
  ]);
  assert.deepEqual(WEBVIEW_POSTED_MESSAGE_TYPES, [
    'ready',
    'showRawJson',
    'updatePreviewLines'
  ]);
});

test('webview line-count state helpers preserve progress and ready states', () => {
  const payload = {
    fileName: 'large.json',
    fileSize: '12.0 MB',
    fileSizeBytes: 12_000_000,
    lastModified: 'today',
    largeFileThresholdMb: 10,
    thresholdBytes: 10_485_760,
    previewLines: 100,
    maxAllowablePreviewLines: 10000,
    lineCount: null,
    preview: {
      lines: [],
      loadedLineCount: 0,
      displayLimit: 100,
      truncatedLineCount: 0,
      truncatedByLineLimit: false
    }
  };

  assert.deepEqual(withLineCountState(payload), {
    ...payload,
    lineCountState: 'counting',
    lineCountProgress: null
  });
  assert.deepEqual(withLineCountState({ ...payload, lineCount: 3 }), {
    ...payload,
    lineCount: 3,
    lineCountState: 'ready',
    lineCountProgress: null
  });
  assert.deepEqual(normalizeLineCountProgress({ percent: 25, lineCount: 10 }), {
    percent: 25,
    lineCount: 10
  });
  assert.deepEqual(normalizeLineCountProgress({ percent: 50 }), {
    percent: 50,
    lineCount: null
  });
  assert.equal(normalizeLineCountProgress({ percent: Number.NaN }), null);
  assert.equal(normalizeLineCountProgress(null), null);
});

test('webview numeric submissions use defensive fallback messages', () => {
  const originalString = globalThis.String;

  globalThis.String = ((value?: unknown): string => {
    if (value === 7) {
      return undefined as unknown as string;
    }

    return originalString(value);
  }) as StringConstructor;
  try {
    assert.deepEqual(getPreviewLinesSubmission('7', '', -1), {
      kind: 'invalid',
      message: 'Preview line count must be a positive integer.'
    });
  } finally {
    globalThis.String = originalString;
  }
});
