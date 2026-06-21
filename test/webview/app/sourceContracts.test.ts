import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test } from 'node:test';

const SOURCE_FILES = [
  'src/extension.ts',
  'src/viewerProvider.ts',
  'src/webview/html.ts',
  'src/webview/styles.ts',
  'src/webview/script.ts',
  'src/webview/app/main.ts',
  'src/webview/app/app.ts',
  'src/webview/app/dom.ts',
  'src/webview/app/render.ts',
  'src/webview/lib/highlight.ts',
  'src/webview/lib/protocol.ts',
  'out/webview/main.js'
];

async function readExtensionSource(): Promise<string> {
  const sources = await Promise.all(
    SOURCE_FILES.map((sourceFile) =>
      fs.readFile(path.join(process.cwd(), sourceFile), 'utf8')
    )
  );

  return sources.join('\n');
}

test('custom editor enables the VS Code find widget for webview search', async () => {
  const source = await readExtensionSource();

  assert.match(
    source,
    /webviewOptions: \{[\s\S]*?enableFindWidget: true,[\s\S]*?retainContextWhenHidden: true/
  );
  assert.match(source, /<main id="content" tabindex="-1">/);
  assert.match(source, /content\.focus\(\{ preventScroll: true \}\);/);
});

test('webview renders highlighted readonly text without JSON parsing', async () => {
  const source = await readExtensionSource();

  assert.doesNotMatch(source, /textarea|contenteditable|raw-contents/);
  assert.doesNotMatch(source, /rawContents/);
  assert.doesNotMatch(source, /JSON\.parse/);
  assert.match(source, /const pre = document\.createElement\('pre'\);/);
  assert.match(source, /function highlightJsonLine\(line: string\)/);
  assert.match(
    source,
    /span\.className = `json-token json-token-\$\{token\.kind\}`;/
  );
  assert.match(source, /span\.textContent = token\.text;/);
  assert.match(source, /document\.createTextNode\(token\.text\)/);
  assert.match(source, /\.json-token-key/);
  assert.match(source, /--quick-json-key: #9cdcfe;/);
  assert.match(source, /body\.vscode-dark/);
  assert.match(source, /color: var\(--quick-json-key\);/);
  assert.match(source, /font-weight: 600;/);
  assert.match(source, /\.json-token-string/);
  assert.match(source, /\.json-token-number/);
  assert.match(source, /\.json-token-literal/);
  assert.match(source, /\.json-token-punctuation/);
  assert.match(
    source,
    /appendHighlightedPreview\([\s\S]*?data\.preview\.lines\.map\(\(line\) => line\.text\),[\s\S]*?data\.preview\.truncatedByLineLimit[\s\S]*?\);/
  );
  assert.match(source, /pre\.append\(document\.createTextNode\('\.\.\.'\)\);/);
});

test('webview top bar exposes size, preview-line, modified, and status controls', async () => {
  const source = await readExtensionSource();

  assert.match(source, /<strong>Size:<\/strong>/);
  assert.match(source, /<strong>Total lines:<\/strong>/);
  assert.match(source, /id="line-count">Counting\.\.\.<\/span>/);
  assert.doesNotMatch(source, /id="threshold-input"|Threshold<\/strong>/);
  assert.match(source, /<strong>Show<\/strong>[\s\S]*<span>lines<\/span>/);
  assert.match(source, /<strong>Modified:<\/strong>/);
  assert.match(source, /id="preview-status" class="info-item"/);
  assert.match(
    source,
    /\.info-item:not\(:first-child\)::before[\s\S]*content: "\|";/
  );
  assert.match(source, /elements\.fileSize\.textContent = payload\.fileSize;/);
  assert.doesNotMatch(source, /payload\.fileSize \+ ' \('/);
});

test('webview renders line-count progress, final count, and unavailable states', async () => {
  const source = await readExtensionSource();

  assert.match(source, /message\.type === 'lineCount'/);
  assert.match(source, /message\.type === 'lineCountProgress'/);
  assert.match(source, /message\.type === 'lineCountError'/);
  assert.match(source, /function setLineCountText\(/);
  assert.match(source, /elements\.lineCount\.textContent = 'Unavailable';/);
  assert.match(
    source,
    /elements\.lineCount\.textContent = formatInteger\(value\);/
  );
  assert.match(source, /'Counting ' \+ formatPercent\(progress\.percent\)/);
});

test('webview exposes Truncated and Show raw JSON view buttons', async () => {
  const source = await readExtensionSource();

  assert.match(source, /id="truncated-view"[\s\S]*>Truncated<\/button>/);
  assert.match(source, /id="show-raw-json"[\s\S]*>Show raw JSON<\/button>/);
  assert.match(source, /vscode\.postMessage\(\{ type: 'showRawJson' \}\);/);
  assert.match(
    source,
    /elements\.truncatedButton\.setAttribute\('aria-pressed', 'true'\);/
  );
  assert.match(
    source,
    /elements\.showRawButton\.setAttribute\('aria-pressed', 'false'\);/
  );
});
