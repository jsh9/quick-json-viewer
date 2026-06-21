import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES } from '../../src/json/settings';
import { readJsonPreview } from '../../src/json/preview';
import { writeJsonFixture } from '../support/jsonFixtures';

test('preview reads only the requested first lines', async () => {
  const filePath = await writeJsonFixture(
    'preview.json',
    Array.from({ length: 5 }, (_, index) => `{"index":${index}}`).join('\n')
  );

  const preview = await readJsonPreview(filePath, {
    largeFileThresholdMb: 0,
    previewLines: 3,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });

  assert.equal(preview.loadedLineCount, 3);
  assert.equal(preview.mode, 'raw');
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
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.deepEqual(
    crlf.lines.map((line) => line.text),
    ['{"a":1}', '{"b":2}']
  );
  assert.equal(crlf.mode, 'raw');
  assert.equal(crlf.truncatedByLineLimit, false);

  const emptyPath = await writeJsonFixture('empty.json', '');
  const empty = await readJsonPreview(emptyPath, {
    largeFileThresholdMb: 0,
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(empty.mode, 'raw');
  assert.equal(empty.loadedLineCount, 0);
  assert.equal(empty.truncatedByLineLimit, false);
});

test('preview formats likely minified JSON until the requested line limit', async () => {
  const filePath = await writeJsonFixture(
    'minified.json',
    makeLongMinifiedJson()
  );

  const preview = await readJsonPreview(filePath, {
    largeFileThresholdMb: 0,
    previewLines: 8,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });

  assert.equal(preview.mode, 'formatted');
  assert.equal(preview.loadedLineCount, 8);
  assert.equal(preview.truncatedByLineLimit, true);
  assert.deepEqual(
    preview.lines.map((line) => line.text),
    [
      '{',
      '    "id": 0,',
      '    "active": true,',
      '    "name": "Ada",',
      '    "missing": null,',
      '    "path": "C:\\\\tmp\\\\file.json",',
      '    "quote": "a \\"quoted\\" value",',
      '    "unicode": "café 東京 🚀",'
    ]
  );
});

test('preview keeps short, JSONL, and malformed likely-minified input in raw mode', async () => {
  const shortPath = await writeJsonFixture('short-minified.json', '{"a":1}');
  const shortPreview = await readJsonPreview(shortPath, {
    largeFileThresholdMb: 0,
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(shortPreview.mode, 'raw');

  const jsonlPath = await writeJsonFixture('jsonl.json', '{"a":1}\n{"b":2}');
  const jsonlPreview = await readJsonPreview(jsonlPath, {
    largeFileThresholdMb: 0,
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(jsonlPreview.mode, 'raw');
  assert.deepEqual(
    jsonlPreview.lines.map((line) => line.text),
    ['{"a":1}', '{"b":2}']
  );

  const malformedPath = await writeJsonFixture(
    'malformed-minified.json',
    '{"ok":true,"bad":oops,' + '"value":1,'.repeat(600) + '"end":2}'
  );
  const malformedPreview = await readJsonPreview(malformedPath, {
    largeFileThresholdMb: 0,
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(malformedPreview.mode, 'raw');
  assert.match(malformedPreview.lines[0]?.text ?? '', /"bad":oops/);
});

test('preview completes formatted minified JSON with whitespace and empty structures', async () => {
  const filePath = await writeJsonFixture(
    'complete-minified.json',
    '{ "emptyObject":{},"emptyArray":[],"numbers":[-1,2.5e+3],"flag":false,"tail":[' +
      Array.from({ length: 1400 }, (_, index) => String(index)).join(',') +
      ']}'
  );

  const preview = await readJsonPreview(filePath, {
    largeFileThresholdMb: 0,
    previewLines: 2000,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });

  assert.equal(preview.mode, 'formatted');
  assert.equal(preview.truncatedByLineLimit, false);
  assert.ok(preview.lines.some((line) => line.text === '    "emptyObject": {'));
  assert.ok(preview.lines.some((line) => line.text === '    "emptyArray": ['));
  assert.ok(preview.lines.some((line) => line.text === '        -1,'));
  assert.ok(preview.lines.some((line) => line.text === '    "flag": false,'));
});

test('formatted preview truncates long rendered string lines', async () => {
  const filePath = await writeJsonFixture(
    'formatted-long-line.json',
    '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7,"h":8,"huge":"' +
      'x'.repeat(5000) +
      '"}'
  );

  const preview = await readJsonPreview(
    filePath,
    {
      largeFileThresholdMb: 0,
      previewLines: 20,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    },
    { maxRenderedLineCharacters: 24 }
  );

  assert.equal(preview.mode, 'formatted');
  assert.equal(preview.truncatedLineCount, 1);
  const hugeLine = preview.lines.find((line) => line.truncated);
  assert.equal(hugeLine?.text, '    "huge": "xxxxxxxxxxx');
  assert.ok((hugeLine?.originalLength ?? 0) > 5000);
});

test('malformed minified structures fall back to raw preview', async () => {
  const unclosedPath = await writeJsonFixture(
    'unclosed-minified.json',
    '{"a":1,' + '"b":2,'.repeat(700)
  );
  const unclosedPreview = await readJsonPreview(unclosedPath, {
    largeFileThresholdMb: 0,
    previewLines: 2000,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(unclosedPreview.mode, 'raw');

  const extraClosePath = await writeJsonFixture(
    'extra-close-minified.json',
    '{"a":1}]' + ',"b":2'.repeat(700)
  );
  const extraClosePreview = await readJsonPreview(extraClosePath, {
    largeFileThresholdMb: 0,
    previewLines: 5,
    maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
  });
  assert.equal(extraClosePreview.mode, 'raw');

  const unterminatedStringPath = await writeJsonFixture(
    'unterminated-string-minified.json',
    '{"a":1,"b":2,"c":3,"d":4,"e":5,"f":6,"g":7,"h":8,"text":"' +
      'x'.repeat(5000)
  );
  const unterminatedStringPreview = await readJsonPreview(
    unterminatedStringPath,
    {
      largeFileThresholdMb: 0,
      previewLines: 2000,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    }
  );
  assert.equal(unterminatedStringPreview.mode, 'raw');
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
      previewLines: 1,
      maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
    },
    { maxRenderedLineCharacters: 6 }
  );

  assert.equal(preview.loadedLineCount, 1);
  assert.equal(preview.mode, 'raw');
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
        previewLines: 1,
        maxAllowablePreviewLines: DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES
      },
      { signal: controller.signal }
    ),
    /aborted/i
  );
});

function makeLongMinifiedJson(): string {
  return (
    '{"id":0,"active":true,"name":"Ada","missing":null,' +
    '"path":"C:\\\\tmp\\\\file.json",' +
    '"quote":"a \\"quoted\\" value",' +
    '"unicode":"café 東京 🚀",' +
    '"items":[1,2],"tail":[' +
    Array.from({ length: 1200 }, (_, index) => String(index)).join(',') +
    ']}'
  );
}
