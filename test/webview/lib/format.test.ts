import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatBytes,
  formatInteger,
  formatPercent
} from '../../../src/webview/lib/format';

test('webview format helpers render bytes, integers, and percents', () => {
  assert.equal(formatBytes(-1), '0 B');
  assert.equal(formatBytes(1024), '1.00 KB');
  assert.equal(formatBytes(12), '12 B');
  assert.equal(formatInteger(12345.6), '12,345');
  assert.equal(formatInteger(Number.POSITIVE_INFINITY), 'Infinity');
  assert.equal(formatPercent(33.333), '33.3%');
  assert.equal(formatPercent(-5), '0.0%');
  assert.equal(formatPercent(150), '100.0%');
});
