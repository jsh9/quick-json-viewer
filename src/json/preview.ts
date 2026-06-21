import * as fs from 'node:fs';
import { throwIfAborted } from './errors';
import { ViewerSettings } from './settings';

export const DEFAULT_MAX_RENDERED_LINE_CHARACTERS = 200_000;

export interface JsonPreviewLine {
  readonly lineNumber: number;
  readonly text: string;
  readonly truncated: boolean;
  readonly originalLength: number;
}

export interface JsonPreview {
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
          return toPreview(lines, settings.previewLines, true);
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

  return toPreview(lines, settings.previewLines, false);
}

function toPreview(
  lines: JsonPreviewLine[],
  displayLimit: number,
  truncatedByLineLimit: boolean
): JsonPreview {
  return {
    lines,
    loadedLineCount: lines.length,
    displayLimit,
    truncatedLineCount: lines.filter((line) => line.truncated).length,
    truncatedByLineLimit
  };
}
