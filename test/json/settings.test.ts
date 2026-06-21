import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BYTES_PER_MIB,
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  NO_PREVIEW_LINES_LIMIT,
  getThresholdBytes,
  normalizeViewerSettings,
  shouldPreviewFile
} from '../../src/json/settings';

test('settings validation applies defaults and accepts valid values', () => {
  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: -1,
      previewLines: 0
    }),
    {
      largeFileThresholdMb: DEFAULT_LARGE_FILE_THRESHOLD_MB,
      previewLines: DEFAULT_PREVIEW_LINES,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }
  );

  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: 0.5,
      previewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES + 1
    }),
    {
      largeFileThresholdMb: 0.5,
      previewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }
  );
});

test('preview-line safety limit can be raised, disabled, or defaulted', () => {
  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: 10,
      previewLines: 20000,
      maxAllowablePreviewLines: 50000
    }),
    {
      largeFileThresholdMb: 10,
      previewLines: 20000,
      maxAllowablePreviewLines: 50000
    }
  );

  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: 10,
      previewLines: 20000,
      maxAllowablePreviewLines: NO_PREVIEW_LINES_LIMIT
    }),
    {
      largeFileThresholdMb: 10,
      previewLines: 20000,
      maxAllowablePreviewLines: NO_PREVIEW_LINES_LIMIT
    }
  );

  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: 10,
      previewLines: 20000,
      maxAllowablePreviewLines: 0
    }),
    {
      largeFileThresholdMb: 10,
      previewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }
  );
});

test('threshold conversion uses MiB and preview check is strictly greater', () => {
  assert.equal(getThresholdBytes(10), 10 * BYTES_PER_MIB);
  assert.equal(
    shouldPreviewFile(10 * BYTES_PER_MIB, {
      largeFileThresholdMb: 10,
      previewLines: 100,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }),
    false
  );
  assert.equal(
    shouldPreviewFile(10 * BYTES_PER_MIB + 1, {
      largeFileThresholdMb: 10,
      previewLines: 100,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }),
    true
  );
});
