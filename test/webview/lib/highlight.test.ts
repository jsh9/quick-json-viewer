import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  highlightJsonLine,
  type JsonSyntaxToken
} from '../../../src/webview/lib/highlight';

function simplify(
  tokens: readonly JsonSyntaxToken[]
): Array<readonly [JsonSyntaxToken['kind'], string]> {
  return tokens.map((token) => [token.kind, token.text]);
}

function joinedText(tokens: readonly JsonSyntaxToken[]): string {
  return tokens.map((token) => token.text).join('');
}

test('JSON highlighter distinguishes keys from string values', () => {
  const line = '  {"name": "Ada", "city" : "London"}';
  const tokens = highlightJsonLine(line);

  assert.equal(joinedText(tokens), line);
  assert.deepEqual(simplify(tokens), [
    ['plain', '  '],
    ['punctuation', '{'],
    ['key', '"name"'],
    ['punctuation', ':'],
    ['plain', ' '],
    ['string', '"Ada"'],
    ['punctuation', ','],
    ['plain', ' '],
    ['key', '"city"'],
    ['plain', ' '],
    ['punctuation', ':'],
    ['plain', ' '],
    ['string', '"London"'],
    ['punctuation', '}']
  ]);
});

test('JSON highlighter highlights numbers, literals, and punctuation', () => {
  const line =
    '{"count": -12.5e+3, "active": true, "deleted": false, "missing": null}';
  const tokens = highlightJsonLine(line);

  assert.equal(joinedText(tokens), line);
  assert.deepEqual(
    simplify(tokens).filter(([kind]) => kind !== 'plain'),
    [
      ['punctuation', '{'],
      ['key', '"count"'],
      ['punctuation', ':'],
      ['number', '-12.5e+3'],
      ['punctuation', ','],
      ['key', '"active"'],
      ['punctuation', ':'],
      ['literal', 'true'],
      ['punctuation', ','],
      ['key', '"deleted"'],
      ['punctuation', ':'],
      ['literal', 'false'],
      ['punctuation', ','],
      ['key', '"missing"'],
      ['punctuation', ':'],
      ['literal', 'null'],
      ['punctuation', '}']
    ]
  );
});

test('JSON highlighter handles escaped quotes and backslashes inside strings', () => {
  const line = String.raw`{"quote": "a \"quoted\" value", "path": "C:\\tmp\\file.json"}`;
  const tokens = highlightJsonLine(line);

  assert.equal(joinedText(tokens), line);
  assert.deepEqual(
    simplify(tokens).filter(([kind]) => kind === 'key' || kind === 'string'),
    [
      ['key', '"quote"'],
      ['string', String.raw`"a \"quoted\" value"`],
      ['key', '"path"'],
      ['string', String.raw`"C:\\tmp\\file.json"`]
    ]
  );
});

test('JSON highlighter preserves invalid partial JSON and HTML-sensitive text', () => {
  const line = '  "unterminated <tag>&value';
  const tokens = highlightJsonLine(line);

  assert.equal(joinedText(tokens), line);
  assert.deepEqual(simplify(tokens), [
    ['plain', '  '],
    ['string', '"unterminated <tag>&value']
  ]);
});

test('JSON highlighter leaves words and truncation marker as plain text', () => {
  assert.deepEqual(simplify(highlightJsonLine('truthy falsehood nullish')), [
    ['plain', 'truthy falsehood nullish']
  ]);
  assert.deepEqual(simplify(highlightJsonLine('...')), [['plain', '...']]);
});
