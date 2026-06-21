import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHtml } from '../../../src/webview/html';

interface TestWindow {
  readonly document: {
    querySelector(selector: string): TestElement | null;
  };
  readonly MessageEvent: new (
    type: string,
    init?: { readonly data?: unknown }
  ) => unknown;
  readonly KeyboardEvent: new (
    type: string,
    init?: {
      readonly key?: string;
      readonly bubbles?: boolean;
      readonly cancelable?: boolean;
    }
  ) => unknown;
  dispatchEvent(event: unknown): boolean;
  close(): void;
}

interface TestElement {
  textContent: string | null;
  value?: string;
  disabled?: boolean;
  click(): void;
  dispatchEvent(event: unknown): boolean;
  getAttribute(name: string): string | null;
}

interface TestDom {
  readonly window: TestWindow;
}

const { JSDOM } = require('jsdom') as {
  readonly JSDOM: new (
    html: string,
    options: {
      readonly runScripts: 'dangerously';
      readonly pretendToBeVisual: boolean;
      readonly beforeParse: (window: TestWindow) => void;
    }
  ) => TestDom;
};

test('webview posts ready when the bundled app starts', () => {
  const context = createWebviewDom();
  try {
    assert.deepEqual(context.postedMessages, [{ type: 'ready' }]);
    assert.equal(
      getRequiredElement(context.window, '#content .status').textContent,
      'Loading JSON preview...'
    );
  } finally {
    context.window.close();
  }
});

test('webview renders highlighted readonly preview data', () => {
  const context = createWebviewDom();
  try {
    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload()
    });

    assert.equal(context.window.document.querySelector('textarea'), null);
    assert.equal(
      context.window.document.querySelector('[contenteditable]'),
      null
    );
    assert.equal(
      getRequiredElement(context.window, '#file-size').textContent,
      '12.0 MB'
    );
    assert.equal(
      getRequiredElement(context.window, '#preview-lines-input').value,
      '100'
    );
    assert.equal(
      getRequiredElement(context.window, '#preview-status').textContent,
      'Showing first 2 lines'
    );
    assert.equal(
      getRequiredElement(context.window, 'pre.preview-text').textContent,
      '{"name":"Ada"}\n{"active":true}\n...'
    );
    assert.equal(
      getRequiredElement(context.window, '.json-token-key').textContent,
      '"name"'
    );
    assert.equal(
      getRequiredElement(context.window, '.json-token-literal').textContent,
      'true'
    );
  } finally {
    context.window.close();
  }
});

test('webview renders line-count progress, final count, and unavailable states', () => {
  const context = createWebviewDom();
  try {
    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload({ lineCount: null })
    });

    dispatchExtensionMessage(context.window, {
      type: 'lineCountProgress',
      payload: { percent: 25, lineCount: 10 }
    });
    assert.equal(
      getRequiredElement(context.window, '#line-count').textContent,
      'Counting 25.0%'
    );

    dispatchExtensionMessage(context.window, {
      type: 'lineCount',
      lineCount: 12
    });
    assert.equal(
      getRequiredElement(context.window, '#line-count').textContent,
      '12'
    );

    dispatchExtensionMessage(context.window, { type: 'lineCountError' });
    assert.equal(
      getRequiredElement(context.window, '#line-count').textContent,
      'Unavailable'
    );
  } finally {
    context.window.close();
  }
});

test('webview posts showRawJson and toggles the selected view button', () => {
  const context = createWebviewDom();
  try {
    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload()
    });

    getRequiredElement(context.window, '#show-raw-json').click();

    assert.deepEqual(context.postedMessages.at(-1), { type: 'showRawJson' });
    assert.equal(
      getRequiredElement(context.window, '#show-raw-json').getAttribute(
        'aria-pressed'
      ),
      'true'
    );
    assert.equal(
      getRequiredElement(context.window, '#truncated-view').getAttribute(
        'aria-pressed'
      ),
      'false'
    );
  } finally {
    context.window.close();
  }
});

test('webview validates preview-line input and retries failed updates', () => {
  const context = createWebviewDom();
  try {
    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload()
    });
    const input = getRequiredElement(context.window, '#preview-lines-input');

    input.value = '10001';
    pressEnter(context.window, input);
    assert.equal(postedUpdateMessages(context.postedMessages).length, 0);
    assert.equal(
      getRequiredElement(context.window, '#preview-lines-error').textContent,
      'Preview line count must be an integer between 1 and 10,000. To raise this limit, set "quickJsonViewer.maxAllowablePreviewLines" in VS Code User Settings (JSON). Set to "-1" to indicate no limit.'
    );

    input.value = '7';
    pressEnter(context.window, input);
    assert.deepEqual(postedUpdateMessages(context.postedMessages), [
      { type: 'updatePreviewLines', value: 7 }
    ]);

    dispatchExtensionMessage(context.window, {
      type: 'previewLinesError',
      message: 'settings failed'
    });
    pressEnter(context.window, input);
    assert.deepEqual(postedUpdateMessages(context.postedMessages), [
      { type: 'updatePreviewLines', value: 7 },
      { type: 'updatePreviewLines', value: 7 }
    ]);

    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload({ maxAllowablePreviewLines: 20000 })
    });
    input.value = '10001';
    pressEnter(context.window, input);
    assert.deepEqual(postedUpdateMessages(context.postedMessages), [
      { type: 'updatePreviewLines', value: 7 },
      { type: 'updatePreviewLines', value: 7 },
      { type: 'updatePreviewLines', value: 10001 }
    ]);

    dispatchExtensionMessage(context.window, {
      type: 'data',
      payload: createPayload({ maxAllowablePreviewLines: -1 })
    });
    input.value = '25000';
    pressEnter(context.window, input);
    assert.deepEqual(postedUpdateMessages(context.postedMessages), [
      { type: 'updatePreviewLines', value: 7 },
      { type: 'updatePreviewLines', value: 7 },
      { type: 'updatePreviewLines', value: 10001 },
      { type: 'updatePreviewLines', value: 25000 }
    ]);
  } finally {
    context.window.close();
  }
});

function createWebviewDom(): {
  readonly window: TestWindow;
  readonly postedMessages: unknown[];
} {
  const postedMessages: unknown[] = [];
  const dom = new JSDOM(getHtml('large.json'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse(window: TestWindow): void {
      Object.assign(window, {
        acquireVsCodeApi: () => ({
          postMessage: (message: unknown): void => {
            postedMessages.push(toPlainMessage(message));
          }
        })
      });
    }
  });

  return {
    window: dom.window,
    postedMessages
  };
}

function toPlainMessage(message: unknown): unknown {
  return typeof message === 'object' && message !== null
    ? JSON.parse(JSON.stringify(message))
    : message;
}

function createPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    fileName: 'large.json',
    fileSize: '12.0 MB',
    fileSizeBytes: 12_000_000,
    lastModified: 'today',
    largeFileThresholdMb: 10,
    thresholdBytes: 10_485_760,
    previewLines: 100,
    maxAllowablePreviewLines: 10000,
    lineCount: 2,
    preview: {
      lines: [
        {
          lineNumber: 1,
          text: '{"name":"Ada"}',
          truncated: false,
          originalLength: 14
        },
        {
          lineNumber: 2,
          text: '{"active":true}',
          truncated: false,
          originalLength: 15
        }
      ],
      loadedLineCount: 2,
      displayLimit: 100,
      truncatedLineCount: 0,
      truncatedByLineLimit: true
    },
    ...overrides
  };
}

function dispatchExtensionMessage(window: TestWindow, data: unknown): void {
  window.dispatchEvent(new window.MessageEvent('message', { data }));
}

function pressEnter(window: TestWindow, element: TestElement): void {
  element.dispatchEvent(
    new window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    })
  );
}

function getRequiredElement(window: TestWindow, selector: string): TestElement {
  const element = window.document.querySelector(selector);
  assert.ok(element, `Missing element: ${selector}`);
  return element;
}

function postedUpdateMessages(
  messages: readonly unknown[]
): Array<{ readonly type: 'updatePreviewLines'; readonly value: number }> {
  return messages.filter(
    (
      message
    ): message is {
      readonly type: 'updatePreviewLines';
      readonly value: number;
    } =>
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      message.type === 'updatePreviewLines'
  );
}
