import * as assert from 'node:assert/strict';
import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { countJsonLines } from '../../src/json/count';
import { tempDir } from '../support/extensionHarness';
import { writeJsonFixture } from '../support/jsonFixtures';

test('line counter handles empty files, trailing newlines, and final unterminated lines', async () => {
  assert.equal(
    await countJsonLines(await writeJsonFixture('count-empty.json', '')),
    0
  );
  assert.equal(
    await countJsonLines(
      await writeJsonFixture('count-trailing.json', 'a\nb\n')
    ),
    2
  );
  assert.equal(
    await countJsonLines(
      await writeJsonFixture('count-unterminated.json', 'a\nb')
    ),
    2
  );
  assert.equal(
    await countJsonLines(await writeJsonFixture('count-crlf.json', 'a\r\nb')),
    2
  );
});

test('line counter reports byte-scan progress', async () => {
  const progress: Array<{
    bytesRead: number;
    totalBytes: number;
    percent: number;
    lineCount: number;
  }> = [];
  const filePath = await writeJsonFixture('count-progress.json', 'a\nb\nc');

  const lineCount = await countJsonLines(filePath, {
    chunkSize: 2,
    progressIntervalMs: 0,
    onProgress: (event) => progress.push(event)
  });

  assert.equal(lineCount, 3);
  assert.equal(progress[0]?.bytesRead, 0);
  assert.equal(progress[0]?.percent, 0);
  assert.equal(progress.at(-1)?.percent, 100);
  assert.equal(progress.at(-1)?.lineCount, 3);
  assert.ok(progress.some((event) => event.percent > 0 && event.percent < 100));
});

test('line counter reports complete progress for empty files', async () => {
  const progress: Array<{
    bytesRead: number;
    totalBytes: number;
    percent: number;
    lineCount: number;
  }> = [];

  const lineCount = await countJsonLines(
    await writeJsonFixture('count-empty-progress.json', ''),
    {
      progressIntervalMs: 0,
      onProgress: (event) => progress.push(event)
    }
  );

  assert.equal(lineCount, 0);
  assert.equal(progress[0]?.totalBytes, 0);
  assert.equal(progress[0]?.percent, 100);
  assert.equal(progress.at(-1)?.percent, 100);
});

test('line counter accepts non-Buffer stream chunks', async () => {
  const filePath = await writeJsonFixture('count-array-buffer.json', 'a\nb');
  const mutableFs = require('node:fs') as {
    createReadStream: typeof nodeFs.createReadStream;
  };
  const originalCreateReadStream = mutableFs.createReadStream;

  mutableFs.createReadStream = (() => ({
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      yield new Uint8Array([97, 10, 98]);
    },
    destroy: () => undefined
  })) as unknown as typeof nodeFs.createReadStream;

  try {
    assert.equal(await countJsonLines(filePath), 2);
  } finally {
    mutableFs.createReadStream = originalCreateReadStream;
  }
});

test('line counter supports cancellation and missing-file failures', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    countJsonLines(await writeJsonFixture('count-cancel.json', 'a'), {
      signal: controller.signal
    }),
    /aborted/i
  );

  await assert.rejects(
    countJsonLines(path.join(tempDir, 'missing-count.json')),
    /ENOENT/
  );
});
