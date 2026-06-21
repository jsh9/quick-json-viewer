import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BYTES_PER_MIB,
  DEFAULT_LARGE_FILE_THRESHOLD_MB,
  DEFAULT_PREVIEW_LINES,
  MAX_PREVIEW_LINES,
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
      previewLines: DEFAULT_PREVIEW_LINES
    }
  );

  assert.deepEqual(
    normalizeViewerSettings({
      largeFileThresholdMb: 0.5,
      previewLines: MAX_PREVIEW_LINES + 1
    }),
    {
      largeFileThresholdMb: 0.5,
      previewLines: MAX_PREVIEW_LINES
    }
  );
});

test('threshold conversion uses MiB and preview check is strictly greater', () => {
  assert.equal(getThresholdBytes(10), 10 * BYTES_PER_MIB);
  assert.equal(
    shouldPreviewFile(10 * BYTES_PER_MIB, {
      largeFileThresholdMb: 10,
      previewLines: 100
    }),
    false
  );
  assert.equal(
    shouldPreviewFile(10 * BYTES_PER_MIB + 1, {
      largeFileThresholdMb: 10,
      previewLines: 100
    }),
    true
  );
});
