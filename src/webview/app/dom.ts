export interface WebviewElements {
  readonly content: HTMLElement;
  readonly truncatedButton: HTMLButtonElement;
  readonly showRawButton: HTMLButtonElement;
  readonly fileSize: HTMLElement;
  readonly lineCount: HTMLElement;
  readonly previewLinesInput: HTMLInputElement;
  readonly previewLinesError: HTMLElement;
  readonly modified: HTMLElement;
  readonly previewStatus: HTMLElement;
}

export function collectDomElements(): WebviewElements {
  return {
    content: getRequiredElement('content'),
    truncatedButton: getRequiredElement('truncated-view'),
    showRawButton: getRequiredElement('show-raw-json'),
    fileSize: getRequiredElement('file-size'),
    lineCount: getRequiredElement('line-count'),
    previewLinesInput: getRequiredElement('preview-lines-input'),
    previewLinesError: getRequiredElement('preview-lines-error'),
    modified: getRequiredElement('modified'),
    previewStatus: getRequiredElement('preview-status')
  };
}

export function setControlsDisabled(
  elements: WebviewElements,
  disabled: boolean
): void {
  elements.truncatedButton.disabled = disabled;
  elements.showRawButton.disabled = disabled;
  elements.previewLinesInput.disabled = disabled;
}

export function status(message: string): HTMLParagraphElement {
  const element = document.createElement('p');
  element.className = 'status';
  element.textContent = message;
  return element;
}

export function textSpan(message: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.textContent = message;
  return element;
}

function getRequiredElement<TElement extends HTMLElement>(
  id: string
): TElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing webview element: ${id}`);
  }

  return element as TElement;
}
