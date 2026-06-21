import * as fs from 'node:fs';
import { throwIfAborted } from './errors';
import { ViewerSettings } from './settings';

export const DEFAULT_MAX_RENDERED_LINE_CHARACTERS = 200_000;
export const MINIFIED_DETECTION_SAMPLE_BYTES = 64 * 1024;
export const MINIFIED_FIRST_LINE_MIN_CHARACTERS = 4096;
export const MINIFIED_MIN_PUNCTUATION = 16;
export const FORMATTED_PREVIEW_INDENT = 4;

export type JsonPreviewMode = 'raw' | 'formatted';

export interface JsonPreviewLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly truncated: boolean;
  readonly originalLength: number;
}

export interface JsonPreview {
  readonly mode: JsonPreviewMode;
  readonly lines: JsonPreviewLine[];
  readonly loadedLineCount: number;
  readonly displayLimit: number;
  readonly truncatedLineCount: number;
  readonly truncatedByLineLimit: boolean;
}

export interface ReadJsonPreviewOptions {
  readonly signal?: AbortSignal;
  readonly maxRenderedLineCharacters?: number;
}

export async function readJsonPreview(
  filePath: string,
  settings: ViewerSettings,
  options: ReadJsonPreviewOptions = {}
): Promise<JsonPreview> {
  throwIfAborted(options.signal);

  if (await shouldFormatMinifiedJson(filePath, options.signal)) {
    try {
      return await readFormattedJsonPreview(filePath, settings, options);
    } catch (error) {
      throwIfAborted(options.signal);
      if (isFormatterError(error)) {
        return readRawJsonPreview(filePath, settings, options);
      }

      throw error;
    }
  }

  return readRawJsonPreview(filePath, settings, options);
}

async function readRawJsonPreview(
  filePath: string,
  settings: ViewerSettings,
  options: ReadJsonPreviewOptions
): Promise<JsonPreview> {
  throwIfAborted(options.signal);

  const maxRenderedLineCharacters =
    options.maxRenderedLineCharacters ?? DEFAULT_MAX_RENDERED_LINE_CHARACTERS;
  const lines: JsonPreviewLine[] = [];
  const stream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024
  });

  let currentText = '';
  let currentLength = 0;
  let currentTruncated = false;
  let lineNumber = 1;

  const pushCurrentLine = (): void => {
    let text = currentText;
    let originalLength = currentLength;

    if (!currentTruncated && text.endsWith('\r')) {
      text = text.slice(0, -1);
      originalLength -= 1;
    }

    lines.push({
      lineNumber,
      text,
      truncated: currentTruncated,
      originalLength
    });
    lineNumber += 1;
    currentText = '';
    currentLength = 0;
    currentTruncated = false;
  };

  try {
    for await (const chunk of stream) {
      throwIfAborted(options.signal);
      const textChunk = String(chunk);

      for (let index = 0; index < textChunk.length; index += 1) {
        throwIfAborted(options.signal);
        const character = textChunk.charAt(index);

        if (lines.length >= settings.previewLines) {
          return toPreview('raw', lines, settings.previewLines, true);
        }

        if (character === '\n') {
          pushCurrentLine();
          continue;
        }

        currentLength += 1;
        if (currentText.length < maxRenderedLineCharacters) {
          currentText += character;
        } else {
          currentTruncated = true;
        }
      }
    }

    if (lines.length < settings.previewLines && currentLength > 0) {
      pushCurrentLine();
    }
  } finally {
    stream.destroy();
  }

  return toPreview('raw', lines, settings.previewLines, false);
}

async function readFormattedJsonPreview(
  filePath: string,
  settings: ViewerSettings,
  options: ReadJsonPreviewOptions
): Promise<JsonPreview> {
  throwIfAborted(options.signal);

  const maxRenderedLineCharacters =
    options.maxRenderedLineCharacters ?? DEFAULT_MAX_RENDERED_LINE_CHARACTERS;
  const lineWriter = new PreviewLineWriter(
    'formatted',
    settings.previewLines,
    maxRenderedLineCharacters
  );
  const formatter = new StreamingJsonFormatter(lineWriter);
  const stream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: 64 * 1024
  });

  try {
    for await (const chunk of stream) {
      throwIfAborted(options.signal);
      const textChunk = String(chunk);

      for (let index = 0; index < textChunk.length; index += 1) {
        throwIfAborted(options.signal);
        formatter.write(textChunk.charAt(index));

        if (lineWriter.isAtLineLimit()) {
          return lineWriter.toPreview(true);
        }
      }
    }

    formatter.finish();
  } finally {
    stream.destroy();
  }

  return lineWriter.toPreview(false);
}

async function shouldFormatMinifiedJson(
  filePath: string,
  signal: AbortSignal | undefined
): Promise<boolean> {
  throwIfAborted(signal);
  const sample = await readDetectionSample(filePath, signal);
  throwIfAborted(signal);

  if (sample.length < MINIFIED_FIRST_LINE_MIN_CHARACTERS) {
    return false;
  }

  return isLikelyMinifiedJson(sample);
}

async function readDetectionSample(
  filePath: string,
  signal: AbortSignal | undefined
): Promise<string> {
  const stream = fs.createReadStream(filePath, {
    encoding: 'utf8',
    highWaterMark: MINIFIED_DETECTION_SAMPLE_BYTES
  });

  try {
    for await (const chunk of stream) {
      throwIfAborted(signal);
      return String(chunk);
    }
  } finally {
    stream.destroy();
  }

  return '';
}

function isLikelyMinifiedJson(sample: string): boolean {
  const firstNonWhitespaceIndex = findFirstNonWhitespaceIndex(sample);
  if (firstNonWhitespaceIndex === -1) {
    return false;
  }

  const firstCharacter = sample.charAt(firstNonWhitespaceIndex);
  if (firstCharacter !== '{' && firstCharacter !== '[') {
    return false;
  }

  let escaped = false;
  let inString = false;
  let punctuationCount = 0;
  let firstLineLength = 0;

  for (let index = firstNonWhitespaceIndex; index < sample.length; index += 1) {
    const character = sample.charAt(index);

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      } else if (character === '\n' || character === '\r') {
        return false;
      }

      firstLineLength += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      firstLineLength += 1;
      continue;
    }

    if (character === '\n' || character === '\r') {
      return false;
    }

    if (isJsonPunctuation(character)) {
      punctuationCount += 1;
    }

    firstLineLength += 1;
  }

  return (
    firstLineLength >= MINIFIED_FIRST_LINE_MIN_CHARACTERS &&
    punctuationCount >= MINIFIED_MIN_PUNCTUATION
  );
}

function findFirstNonWhitespaceIndex(value: string): number {
  for (let index = 0; index < value.length; index += 1) {
    if (!/\s/.test(value.charAt(index))) {
      return index;
    }
  }

  return -1;
}

function isJsonPunctuation(character: string): boolean {
  return '{}[]:,'.includes(character);
}

class PreviewLineWriter {
  private readonly lines: JsonPreviewLine[] = [];
  private currentText = '';
  private currentLength = 0;
  private currentTruncated = false;
  private lineNumber = 1;

  public constructor(
    private readonly mode: JsonPreviewMode,
    private readonly displayLimit: number,
    private readonly maxRenderedLineCharacters: number
  ) {}

  public append(text: string): void {
    for (let index = 0; index < text.length; index += 1) {
      this.appendCharacter(text.charAt(index));
    }
  }

  public pushLine(): void {
    /* c8 ignore next -- Defensive guard; callers stop as soon as the limit is reached. */
    if (this.isAtLineLimit()) {
      return;
    }

    this.lines.push({
      lineNumber: this.lineNumber,
      text: this.currentText,
      truncated: this.currentTruncated,
      originalLength: this.currentLength
    });
    this.lineNumber += 1;
    this.currentText = '';
    this.currentLength = 0;
    this.currentTruncated = false;
  }

  public resetCurrentLine(): void {
    this.currentText = '';
    this.currentLength = 0;
    this.currentTruncated = false;
  }

  public hasCurrentLineContent(): boolean {
    return this.currentLength > 0;
  }

  public isCurrentLineBlank(): boolean {
    return this.currentText.trim().length === 0;
  }

  public isAtLineLimit(): boolean {
    return this.lines.length >= this.displayLimit;
  }

  public toPreview(truncatedByLineLimit: boolean): JsonPreview {
    return toPreview(
      this.mode,
      this.lines,
      this.displayLimit,
      truncatedByLineLimit
    );
  }

  private appendCharacter(character: string): void {
    this.currentLength += 1;
    if (this.currentText.length < this.maxRenderedLineCharacters) {
      this.currentText += character;
    } else {
      this.currentTruncated = true;
    }
  }
}

class StreamingJsonFormatter {
  private indentLevel = 0;
  private inString = false;
  private escaped = false;
  private primitive = '';

  public constructor(private readonly writer: PreviewLineWriter) {}

  public write(character: string): void {
    /* c8 ignore next -- Defensive guard; the reader stops after the line-limit write. */
    if (this.writer.isAtLineLimit()) {
      return;
    }

    if (this.inString) {
      this.writeStringCharacter(character);
      return;
    }

    if (/\s/.test(character)) {
      this.flushPrimitive();
      return;
    }

    if (character === '"') {
      this.flushPrimitive();
      this.inString = true;
      this.writer.append(character);
      return;
    }

    if (isJsonPunctuation(character)) {
      this.flushPrimitive();
      this.writePunctuation(character);
      return;
    }

    this.primitive += character;
  }

  public finish(): void {
    if (this.inString) {
      throw new FormatterError('Unterminated JSON string.');
    }

    this.flushPrimitive();

    if (this.indentLevel !== 0) {
      throw new FormatterError('Unclosed JSON structure.');
    }

    if (
      this.writer.hasCurrentLineContent() &&
      !this.writer.isCurrentLineBlank()
    ) {
      this.writer.pushLine();
    }
  }

  private writeStringCharacter(character: string): void {
    this.writer.append(character);

    if (this.escaped) {
      this.escaped = false;
      return;
    }

    if (character === '\\') {
      this.escaped = true;
      return;
    }

    if (character === '"') {
      this.inString = false;
      return;
    }

    /* c8 ignore next -- The minified detector rejects real line breaks in strings. */
    if (character === '\n' || character === '\r') {
      throw new FormatterError('JSON string contains an unescaped line break.');
    }
  }

  private writePunctuation(character: string): void {
    if (character === '{' || character === '[') {
      this.writer.append(character);
      this.writer.pushLine();
      this.indentLevel += 1;
      this.startIndentedLine();
      return;
    }

    if (character === '}' || character === ']') {
      if (this.indentLevel <= 0) {
        throw new FormatterError('Unexpected closing JSON delimiter.');
      }

      this.indentLevel -= 1;
      if (!this.writer.isCurrentLineBlank()) {
        this.writer.pushLine();
      } else {
        this.writer.resetCurrentLine();
      }
      this.startIndentedLine();
      this.writer.append(character);
      return;
    }

    if (character === ',') {
      this.writer.append(character);
      this.writer.pushLine();
      this.startIndentedLine();
      return;
    }

    if (character === ':') {
      this.writer.append(': ');
      return;
    }
  }

  private startIndentedLine(): void {
    if (!this.writer.isAtLineLimit()) {
      this.writer.append(
        ' '.repeat(this.indentLevel * FORMATTED_PREVIEW_INDENT)
      );
    }
  }

  private flushPrimitive(): void {
    if (!this.primitive) {
      return;
    }

    if (!isValidPrimitive(this.primitive)) {
      throw new FormatterError(`Invalid JSON primitive: ${this.primitive}`);
    }

    this.writer.append(this.primitive);
    this.primitive = '';
  }
}

class FormatterError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'FormatterError';
  }
}

function isFormatterError(error: unknown): boolean {
  return error instanceof FormatterError;
}

function isValidPrimitive(value: string): boolean {
  return (
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value)
  );
}

function toPreview(
  mode: JsonPreviewMode,
  lines: JsonPreviewLine[],
  displayLimit: number,
  truncatedByLineLimit: boolean
): JsonPreview {
  return {
    mode,
    lines,
    loadedLineCount: lines.length,
    displayLimit,
    truncatedLineCount: lines.filter((line) => line.truncated).length,
    truncatedByLineLimit
  };
}
