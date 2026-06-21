import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { readJsonPreview } from '../../src/json/preview';
import { writeJsonFixture } from '../support/jsonFixtures';

test('preview reads only the requested first lines', async () => {
  const filePath = await writeJsonFixture(
    'preview.json',
    Array.from({ length: 5 }, (_, index) => `{"index":${index}}`).join('\n')
  );

  const preview = await readJsonPreview(filePath, {
    largeFileThresholdMb: 0,
    previewLines: 3
  });

  assert.equal(preview.loadedLineCount, 3);
  assert.equal(preview.displayLimit, 3);
  assert.equal(preview.truncatedByLineLimit, true);
  assert.deepEqual(
    preview.lines.map((line) => line.lineNumber),
    [1, 2, 3]
  );
  assert.match(preview.lines[2]?.text ?? '', /"index":2/);
});

test('preview handles CRLF, empty files, and final lines without newlines', async () => {
  const crlfPath = await writeJsonFixture('crlf.json', '{"a":1}\r\n{"b":2}');
  const crlf = await readJsonPreview(crlfPath, {
    largeFileThresholdMb: 0,
    previewLines: 5
  });
  assert.deepEqual(
    crlf.lines.map((line) => line.text),
    ['{"a":1}', '{"b":2}']
  );
  assert.equal(crlf.truncatedByLineLimit, false);

  const emptyPath = await writeJsonFixture('empty.json', '');
  const empty = await readJsonPreview(emptyPath, {
    largeFileThresholdMb: 0,
    previewLines: 5
  });
  assert.equal(empty.loadedLineCount, 0);
  assert.equal(empty.truncatedByLineLimit, false);
});

test('preview truncates rendered long lines while preserving original length', async () => {
  const filePath = await writeJsonFixture(
    'long-line.json',
    '{"x":"' + 'a'.repeat(8) + '"}'
  );

  const preview = await readJsonPreview(
    filePath,
    {
      largeFileThresholdMb: 0,
      previewLines: 1
    },
    { maxRenderedLineCharacters: 6 }
  );

  assert.equal(preview.loadedLineCount, 1);
  assert.equal(preview.truncatedLineCount, 1);
  assert.equal(preview.truncatedByLineLimit, false);
  assert.equal(preview.lines[0]?.text, '{"x":"');
  assert.equal(preview.lines[0]?.originalLength, 16);
});

test('preview can be cancelled before file work starts', async () => {
  const filePath = await writeJsonFixture('cancel.json', '{"a":1}');
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    readJsonPreview(
      filePath,
      {
        largeFileThresholdMb: 0,
        previewLines: 1
      },
      { signal: controller.signal }
    ),
    /aborted/i
  );
});
