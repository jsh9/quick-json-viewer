import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXTENSION_MESSAGE_TYPES,
  WEBVIEW_POSTED_MESSAGE_TYPES,
  getPreviewLinesSubmission,
  normalizeLineCountProgress,
  withLineCountState
} from '../../../src/webview/lib/protocol';

test('webview preview-line validation rejects invalid input and de-duplicates submitted values', () => {
  assert.deepEqual(getPreviewLinesSubmission('', ''), {
    kind: 'invalid',
    message: 'Lines must be a whole number between 1 and 10,000.'
  });
  assert.equal(getPreviewLinesSubmission('-1', '').kind, 'invalid');
  assert.equal(getPreviewLinesSubmission('1.5', '').kind, 'invalid');
  assert.equal(getPreviewLinesSubmission('10001', '').kind, 'invalid');
  assert.deepEqual(getPreviewLinesSubmission('007', ''), {
    kind: 'changed',
    value: 7,
    submittedValue: '7'
  });
  assert.deepEqual(getPreviewLinesSubmission('7', '7'), {
    kind: 'unchanged',
    value: 7
  });
});

test('webview protocol constants list expected message types', () => {
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
    assert.deepEqual(getPreviewLinesSubmission('7', ''), {
      kind: 'invalid',
      message: 'Lines must be a whole number between 1 and 10,000.'
    });
  } finally {
    globalThis.String = originalString;
  }
});
