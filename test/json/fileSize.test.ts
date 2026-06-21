import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatFileSize } from '../../src/json/fileSize';

test('file sizes are formatted across byte units and invalid inputs', () => {
  assert.equal(formatFileSize(-1), '0 B');
  assert.equal(formatFileSize(Number.NaN), '0 B');
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(999), '999 B');
  assert.equal(formatFileSize(1024), '1.00 KB');
  assert.equal(formatFileSize(10 * 1024 * 1024), '10.0 MB');
});
