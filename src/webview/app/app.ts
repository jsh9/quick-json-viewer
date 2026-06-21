import {
  setControlsDisabled as setDomControlsDisabled,
  type WebviewElements
} from './dom';
import { createRenderer, type VscodeApi } from './render';
import {
  DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES,
  type ExtensionMessage,
  type JsonDataState,
  getPreviewLinesSubmission,
  getPreviewLinesErrorMessage,
  normalizeLineCountProgress,
  withLineCountState
} from '../lib/protocol';

export function createWebviewApp(
  vscode: VscodeApi,
  elements: WebviewElements
): void {
  const content = elements.content;
  let data: JsonDataState | null = null;
  let lastConfirmedPreviewLines = '';
  let maxAllowablePreviewLines = DEFAULT_MAX_ALLOWABLE_PREVIEW_LINES;

  const renderer = createRenderer({
    elements,
    setControlsDisabled,
    setLastPreviewLinesValue: (value) => {
      lastConfirmedPreviewLines = value;
    },
    clearInputErrors
  });

  content.focus({ preventScroll: true });

  elements.truncatedButton.addEventListener('click', () => {
    renderer.updateViewButtons();
    if (data) {
      renderer.renderData(data);
    }
  });

  elements.showRawButton.addEventListener('click', () => {
    elements.showRawButton.setAttribute('aria-pressed', 'true');
    elements.truncatedButton.setAttribute('aria-pressed', 'false');
    vscode.postMessage({ type: 'showRawJson' });
  });

  elements.previewLinesInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitPreviewLines();
    }
  });
  elements.previewLinesInput.addEventListener('blur', () => {
    submitPreviewLines();
  });
  elements.previewLinesInput.addEventListener('input', () => {
    clearPreviewLinesError();
  });

  window.addEventListener(
    'message',
    (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      if (message.type === 'loading') {
        data = null;
        renderer.renderLoading();
        return;
      }

      if (message.type === 'previewLoadStart') {
        data = null;
        maxAllowablePreviewLines = message.payload.maxAllowablePreviewLines;
        renderer.renderPreviewLoading(message.payload);
        return;
      }

      if (message.type === 'data') {
        data = withLineCountState(message.payload);
        maxAllowablePreviewLines = data.maxAllowablePreviewLines;
        renderer.renderData(data);
        return;
      }

      if (message.type === 'lineCount') {
        if (data) {
          data.lineCount = message.lineCount;
          data.lineCountState = 'ready';
          data.lineCountProgress = null;
        }
        renderer.setLineCountText('ready', message.lineCount);
        return;
      }

      if (message.type === 'lineCountProgress') {
        const progress = normalizeLineCountProgress(message.payload);
        if (data) {
          data.lineCountState = 'counting';
          data.lineCountProgress = progress;
        }
        renderer.setLineCountText(
          'counting',
          data?.lineCount ?? null,
          progress
        );
        return;
      }

      if (message.type === 'lineCountError') {
        if (data) {
          data.lineCountState = 'unavailable';
          data.lineCountProgress = null;
        }
        renderer.setLineCountText('unavailable', null);
        return;
      }

      if (message.type === 'previewLinesError') {
        showPreviewLinesError(
          message.message ||
            getPreviewLinesErrorMessage(maxAllowablePreviewLines)
        );
        return;
      }

      if (message.type === 'error') {
        data = null;
        renderer.renderError(message.message);
      }
    }
  );

  vscode.postMessage({ type: 'ready' });

  function submitPreviewLines(): void {
    const submission = getPreviewLinesSubmission(
      elements.previewLinesInput.value,
      lastConfirmedPreviewLines,
      maxAllowablePreviewLines
    );
    if (submission.kind === 'invalid') {
      showPreviewLinesError(submission.message);
      return;
    }

    if (submission.kind === 'unchanged') {
      return;
    }

    clearPreviewLinesError();
    vscode.postMessage({
      type: 'updatePreviewLines',
      value: submission.value
    });
  }

  function setControlsDisabled(disabled: boolean): void {
    setDomControlsDisabled(elements, disabled);
  }

  function clearInputErrors(): void {
    clearPreviewLinesError();
  }

  function clearPreviewLinesError(): void {
    elements.previewLinesInput.classList.remove('invalid');
    elements.previewLinesError.textContent = '';
  }

  function showPreviewLinesError(message: string): void {
    elements.previewLinesInput.classList.add('invalid');
    elements.previewLinesError.textContent = message;
  }
}
