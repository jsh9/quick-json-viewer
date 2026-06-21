import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAbortError, throwIfAborted } from '../../src/json/errors';

test('abort helpers classify and throw abort errors', () => {
  assert.equal(isAbortError(new Error('x')), false);
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => throwIfAborted(controller.signal), /aborted/i);

  try {
    throwIfAborted(controller.signal);
  } catch (error) {
    assert.equal(isAbortError(error), true);
  }
});
