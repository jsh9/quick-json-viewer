import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import * as json from '../src/json';

test('json barrel exports public helpers', () => {
  assert.equal(typeof json.countJsonLines, 'function');
  assert.equal(typeof json.readJsonPreview, 'function');
  assert.equal(typeof json.normalizeViewerSettings, 'function');
  assert.equal(typeof json.formatFileSize, 'function');
  assert.equal(typeof json.isAbortError, 'function');
});
