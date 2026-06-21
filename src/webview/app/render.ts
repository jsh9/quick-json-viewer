import { formatInteger, formatPercent } from '../lib/format';
import { highlightJsonLine, type JsonSyntaxToken } from '../lib/highlight';
import type {
  JsonDataState,
  LineCountState,
  NormalizedLineCountProgress,
  PreviewLoadPayload
} from '../lib/protocol';
import { status, type WebviewElements } from './dom';

export interface VscodeApi {
  postMessage(message: unknown): void;
}

export interface Renderer {
  readonly renderLoading: () => void;
  readonly renderPreviewLoading: (payload: PreviewLoadPayload) => void;
  readonly renderError: (message: string | undefined) => void;
  readonly renderData: (data: JsonDataState) => void;
  readonly setLineCountText: (
    state: LineCountState,
    value: number | null,
    progress?: NormalizedLineCountProgress | null
  ) => void;
  readonly updateViewButtons: () => void;
}

export function createRenderer(context: {
  readonly elements: WebviewElements;
  readonly setControlsDisabled: (disabled: boolean) => void;
  readonly setLastPreviewLinesValue: (value: string) => void;
  readonly clearInputErrors: () => void;
}): Renderer {
  const elements = context.elements;
  const content = elements.content;

  function renderLoading(): void {
    context.setControlsDisabled(true);
    elements.fileSize.textContent = 'Loading...';
    elements.lineCount.textContent = 'Counting...';
    elements.previewLinesInput.value = '';
    context.setLastPreviewLinesValue('');
    elements.modified.textContent = 'Loading...';
    elements.previewStatus.textContent = '';
    context.clearInputErrors();
    content.replaceChildren(status('Loading JSON preview...'));
  }

  function renderPreviewLoading(payload: PreviewLoadPayload): void {
    context.setControlsDisabled(true);
    renderMetadata(payload);
    setLineCountText(
      payload.lineCount === null ? 'counting' : 'ready',
      payload.lineCount
    );
    elements.previewStatus.textContent = 'Loading preview...';
    content.replaceChildren(status('Loading JSON preview...'));
  }

  function renderError(message: string | undefined): void {
    context.setControlsDisabled(true);
    elements.fileSize.textContent = 'Unavailable';
    elements.lineCount.textContent = 'Unavailable';
    elements.previewLinesInput.value = '';
    context.setLastPreviewLinesValue('');
    elements.modified.textContent = 'Unavailable';
    elements.previewStatus.textContent = '';
    context.clearInputErrors();
    const panel = document.createElement('div');
    panel.className = 'error-panel';
    panel.textContent = message || 'Unable to load JSON file.';
    content.replaceChildren(panel);
  }

  function renderData(data: JsonDataState): void {
    context.setControlsDisabled(false);
    updateViewButtons();
    renderMetadata(data);
    setLineCountText(
      data.lineCountState,
      data.lineCount,
      data.lineCountProgress
    );

    const loaded = data.preview.loadedLineCount;
    const lineLabel = loaded === 1 ? 'line' : 'lines';
    elements.previewStatus.textContent =
      'Showing first ' + formatInteger(loaded) + ' ' + lineLabel;

    const fragment = document.createDocumentFragment();
    const truncated = data.preview.truncatedLineCount;
    if (truncated > 0) {
      const notice = document.createElement('p');
      notice.className = 'status';
      notice.textContent =
        formatInteger(truncated) +
        ' long ' +
        (truncated === 1 ? 'line was' : 'lines were') +
        ' truncated for rendering.';
      fragment.append(notice);
    }

    if (data.preview.lines.length === 0) {
      fragment.append(status('No lines loaded from this JSON file.'));
    }

    const frame = document.createElement('section');
    frame.className = 'preview-frame';
    const pre = document.createElement('pre');
    pre.className = 'preview-text';
    appendHighlightedPreview(
      pre,
      data.preview.lines.map((line) => line.text),
      data.preview.truncatedByLineLimit
    );
    frame.append(pre);
    fragment.append(frame);

    content.replaceChildren(fragment);
  }

  function renderMetadata(payload: PreviewLoadPayload): void {
    elements.fileSize.textContent = payload.fileSize;
    elements.previewLinesInput.value = String(payload.previewLines);
    context.setLastPreviewLinesValue(elements.previewLinesInput.value);
    elements.modified.textContent = payload.lastModified;
  }

  function setLineCountText(
    state: LineCountState,
    value: number | null,
    progress?: NormalizedLineCountProgress | null
  ): void {
    if (state === 'unavailable') {
      elements.lineCount.textContent = 'Unavailable';
      return;
    }

    if (state === 'ready' && value !== null) {
      elements.lineCount.textContent = formatInteger(value);
      return;
    }

    elements.lineCount.textContent = progress
      ? 'Counting ' + formatPercent(progress.percent)
      : 'Counting...';
  }

  function updateViewButtons(): void {
    elements.truncatedButton.setAttribute('aria-pressed', 'true');
    elements.showRawButton.setAttribute('aria-pressed', 'false');
  }

  function appendHighlightedPreview(
    pre: HTMLPreElement,
    previewLines: readonly string[],
    truncatedByLineLimit: boolean
  ): void {
    previewLines.forEach((line, index) => {
      if (index > 0) {
        pre.append(document.createTextNode('\n'));
      }
      appendHighlightedLine(pre, line);
    });

    if (truncatedByLineLimit) {
      if (previewLines.length > 0) {
        pre.append(document.createTextNode('\n'));
      }
      pre.append(document.createTextNode('...'));
    }
  }

  function appendHighlightedLine(pre: HTMLPreElement, line: string): void {
    for (const token of highlightJsonLine(line)) {
      pre.append(createTokenNode(token));
    }
  }

  function createTokenNode(token: JsonSyntaxToken): Node {
    if (token.kind === 'plain') {
      return document.createTextNode(token.text);
    }

    const span = document.createElement('span');
    span.className = `json-token json-token-${token.kind}`;
    span.textContent = token.text;
    return span;
  }

  return {
    renderLoading,
    renderPreviewLoading,
    renderError,
    renderData,
    setLineCountText,
    updateViewButtons
  };
}
