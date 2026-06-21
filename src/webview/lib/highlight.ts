export type JsonSyntaxTokenKind =
  | 'plain'
  | 'key'
  | 'string'
  | 'number'
  | 'literal'
  | 'punctuation';

export interface JsonSyntaxToken {
  readonly kind: JsonSyntaxTokenKind;
  readonly text: string;
}

const NUMBER_PATTERN = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const LITERALS = ['true', 'false', 'null'] as const;
const PUNCTUATION = new Set(['{', '}', '[', ']', ':', ',']);

export function highlightJsonLine(line: string): JsonSyntaxToken[] {
  const tokens: JsonSyntaxToken[] = [];
  let index = 0;

  while (index < line.length) {
    const char = line[index] ?? '';

    if (char === '"') {
      const endIndex = readStringEnd(line, index);
      const text = line.slice(index, endIndex);
      appendToken(tokens, isObjectKey(line, endIndex) ? 'key' : 'string', text);
      index = endIndex;
      continue;
    }

    if (PUNCTUATION.has(char)) {
      appendToken(tokens, 'punctuation', char);
      index += 1;
      continue;
    }

    const literal = readLiteral(line, index);
    if (literal) {
      appendToken(tokens, 'literal', literal);
      index += literal.length;
      continue;
    }

    const number = readNumber(line, index);
    if (number) {
      appendToken(tokens, 'number', number);
      index += number.length;
      continue;
    }

    appendToken(tokens, 'plain', char);
    index += 1;
  }

  return tokens;
}

function appendToken(
  tokens: JsonSyntaxToken[],
  kind: JsonSyntaxTokenKind,
  text: string
): void {
  const previous = tokens.at(-1);
  if (previous?.kind === kind) {
    tokens[tokens.length - 1] = {
      kind,
      text: previous.text + text
    };
    return;
  }

  tokens.push({ kind, text });
}

function readStringEnd(line: string, startIndex: number): number {
  let escaped = false;
  let index = startIndex + 1;

  while (index < line.length) {
    const char = line[index];

    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '"') {
      return index + 1;
    }

    index += 1;
  }

  return line.length;
}

function isObjectKey(line: string, stringEndIndex: number): boolean {
  let index = stringEndIndex;
  while (/\s/.test(line[index] ?? '')) {
    index += 1;
  }

  return line[index] === ':';
}

function readLiteral(line: string, index: number): string | undefined {
  for (const literal of LITERALS) {
    if (
      line.startsWith(literal, index) &&
      !isIdentifierChar(line[index - 1] ?? '') &&
      !isIdentifierChar(line[index + literal.length] ?? '')
    ) {
      return literal;
    }
  }

  return undefined;
}

function readNumber(line: string, index: number): string | undefined {
  NUMBER_PATTERN.lastIndex = index;
  return NUMBER_PATTERN.exec(line)?.[0];
}

function isIdentifierChar(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}
