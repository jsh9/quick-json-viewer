import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  FakeUri,
  FakeVscode,
  FakeWebviewPanel,
  activateAndGetProvider,
  getMessageType,
  loadExtension,
  sleep,
  tempDir,
  waitFor,
  waitForMessage,
  writeFixture
} from './support/extensionHarness';

test('custom editor posts readonly preview data for files above threshold', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('large & value.json', '{"a":1}\n{"b":2}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    harness.fake.previewLines = 1;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(filePath);
    const document = await provider.openCustomDocument(uri);

    await provider.resolveCustomEditor(document, panel, {});
    assert.deepEqual(panel.webview.options, { enableScripts: true });
    assert.match(panel.webview.html, /large &amp; value\.json/);
    assert.doesNotMatch(
      panel.webview.html,
      /textarea|contenteditable|raw-contents/
    );
    assert.deepEqual(panel.revealCalls, [[FakeVscode.ViewColumn.One, false]]);
    assert.equal(panel.webview.messages.length, 0);

    panel.webview.receive({ type: 'ready' });
    const data = await waitForMessage<{
      readonly type: string;
      readonly payload: {
        readonly largeFileThresholdMb: number;
        readonly previewLines: number;
        readonly lineCount: number | null;
        readonly preview: { readonly lines: unknown[] };
      };
    }>(panel, (message) => message.type === 'data');

    assert.equal(data.payload.largeFileThresholdMb, 0);
    assert.equal(data.payload.previewLines, 1);
    assert.equal(data.payload.lineCount, null);
    assert.equal(data.payload.preview.lines.length, 1);
    const lineCount = await waitForMessage<{
      readonly type: string;
      readonly lineCount: number;
    }>(panel, (message) => message.type === 'lineCount');
    assert.equal(lineCount.lineCount, 2);
    assert.deepEqual(
      panel.webview.messages
        .map((message) => getMessageType(message))
        .slice(0, 3),
      ['loading', 'previewLoadStart', 'data']
    );
  } finally {
    panel.dispose();
    harness.restore();
  }
});

test('line counting reports progress and reuses in-flight and cached counts', async () => {
  let resolveCount: ((lineCount: number) => void) | undefined;
  const countCalls: string[] = [];
  const harness = loadExtension(
    {
      countJsonLines: async (
        filePath: string,
        options: {
          readonly onProgress?: (event: {
            readonly bytesRead: number;
            readonly totalBytes: number;
            readonly percent: number;
            readonly lineCount: number;
          }) => void;
        }
      ) => {
        countCalls.push(filePath);
        options.onProgress?.({
          bytesRead: 1,
          totalBytes: 2,
          percent: 50,
          lineCount: 1
        });
        return new Promise<number>((resolve) => {
          resolveCount = resolve;
        });
      }
    },
    {
      watch: () => ({
        on: () => undefined,
        close: () => undefined
      })
    }
  );
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(
      await writeFixture('count-cache.json', '{"a":1}\n{"b":2}')
    );
    const document = await provider.openCustomDocument(uri);
    await provider.resolveCustomEditor(document, panel, {});
    panel.webview.receive({ type: 'ready' });
    await waitForMessage(panel, (message) => message.type === 'data');
    await waitForMessage(
      panel,
      (message) => message.type === 'lineCountProgress'
    );
    assert.equal(countCalls.length, 1);

    panel.webview.messages.length = 0;
    harness.fake.fireConfigurationChange(['quickJsonViewer.previewLines']);
    await waitForMessage(panel, (message) => message.type === 'data');
    assert.equal(countCalls.length, 1);

    resolveCount?.(2);
    const lineCount = await waitForMessage<{
      readonly type?: unknown;
      readonly lineCount: number;
    }>(panel, (message) => message.type === 'lineCount');
    assert.equal(lineCount.lineCount, 2);

    panel.webview.messages.length = 0;
    harness.fake.fireConfigurationChange(['quickJsonViewer.previewLines']);
    const cachedData = await waitForMessage<{
      readonly type?: unknown;
      readonly payload: { readonly lineCount: number | null };
    }>(panel, (message) => message.type === 'data');
    assert.equal(cachedData.payload.lineCount, 2);
    assert.equal(countCalls.length, 1);

    panel.webview.messages.length = 0;
    harness.fake.fireSave(uri);
    await waitForMessage(panel, (message) => message.type === 'data');
    await waitFor(() => countCalls.length === 2);
  } finally {
    panel.dispose();
    resolveCount?.(2);
    harness.restore();
  }
});

test('line count failures are posted while aborts and disposed panels stay quiet', async () => {
  const failingHarness = loadExtension({
    countJsonLines: async () => {
      throw new Error('count failed');
    }
  });
  const failingPanel = new FakeWebviewPanel();
  try {
    failingHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(failingHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('count-fails.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, failingPanel, {});
    failingPanel.webview.receive({ type: 'ready' });
    await waitForMessage(failingPanel, (message) => message.type === 'data');
    const error = await waitForMessage<{
      readonly type?: unknown;
      readonly message: string;
    }>(failingPanel, (message) => message.type === 'lineCountError');
    assert.equal(error.message, 'count failed');
  } finally {
    failingPanel.dispose();
    failingHarness.restore();
  }

  const abortHarness = loadExtension({
    countJsonLines: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
  });
  const abortPanel = new FakeWebviewPanel();
  try {
    abortHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(abortHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('count-aborts.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, abortPanel, {});
    abortPanel.webview.receive({ type: 'ready' });
    await waitForMessage(abortPanel, (message) => message.type === 'data');
    await sleep(20);
    assert.equal(
      abortPanel.webview.messages.some(
        (message) => getMessageType(message) === 'lineCountError'
      ),
      false
    );
  } finally {
    abortPanel.dispose();
    abortHarness.restore();
  }

  let releaseCount: (() => void) | undefined;
  const staleHarness = loadExtension({
    countJsonLines: async (
      _filePath: string,
      options: {
        readonly onProgress?: (event: {
          readonly bytesRead: number;
          readonly totalBytes: number;
          readonly percent: number;
          readonly lineCount: number;
        }) => void;
      }
    ) => {
      await new Promise<void>((resolve) => {
        releaseCount = resolve;
      });
      options.onProgress?.({
        bytesRead: 1,
        totalBytes: 1,
        percent: 100,
        lineCount: 1
      });
      return 1;
    }
  });
  const stalePanel = new FakeWebviewPanel();
  try {
    staleHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(staleHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('count-stale.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, stalePanel, {});
    stalePanel.webview.receive({ type: 'ready' });
    await waitForMessage(stalePanel, (message) => message.type === 'data');
    stalePanel.dispose();
    releaseCount?.();
    await sleep(20);
    assert.equal(
      stalePanel.webview.messages.some(
        (message) =>
          getMessageType(message) === 'lineCount' ||
          getMessageType(message) === 'lineCountProgress'
      ),
      false
    );
  } finally {
    staleHarness.restore();
  }
});

test('custom editor hands files at or below threshold to the default editor', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('small.json', '{"a":1}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 10;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(filePath);
    const document = await provider.openCustomDocument(uri);

    await provider.resolveCustomEditor(document, panel, {});
    panel.webview.receive({ type: 'ready' });
    await waitFor(() => panel.disposed);

    assert.deepEqual(harness.fake.executedCommands.at(-1), {
      command: 'vscode.openWith',
      args: [uri, 'default', FakeVscode.ViewColumn.One]
    });
  } finally {
    harness.restore();
  }
});

test('show raw JSON disengages the extension and opens the default editor', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('show-raw.json', '{"a":1}\n{"b":2}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(filePath);
    const document = await provider.openCustomDocument(uri);

    await provider.resolveCustomEditor(document, panel, {});
    panel.webview.receive({ type: 'showRawJson' });
    await waitFor(() => panel.disposed);

    assert.deepEqual(harness.fake.executedCommands.at(-1), {
      command: 'vscode.openWith',
      args: [uri, 'default', FakeVscode.ViewColumn.One]
    });
  } finally {
    harness.restore();
  }
});

test('custom editor validates preview-line setting messages and writes valid updates', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('settings.json', '{"a":1}');
  const panel = new FakeWebviewPanel();
  try {
    const provider = activateAndGetProvider(harness);
    const document = await provider.openCustomDocument(FakeUri.file(filePath));
    await provider.resolveCustomEditor(document, panel, {});

    panel.webview.receive({ type: 'updatePreviewLines', value: 0 });
    await waitForMessage(
      panel,
      (message) => message.type === 'previewLinesError'
    );

    panel.webview.receive({ type: 'updatePreviewLines', value: 10001 });
    await waitFor(
      () =>
        panel.webview.messages.filter(
          (message) => getMessageType(message) === 'previewLinesError'
        ).length === 2
    );

    panel.webview.receive({ type: 'updatePreviewLines', value: 7 });
    await waitFor(() => harness.fake.configurationUpdates.length === 1);
    assert.deepEqual(harness.fake.configurationUpdates, [
      {
        key: 'previewLines',
        value: 7,
        target: FakeVscode.ConfigurationTarget.Global
      }
    ]);
  } finally {
    panel.dispose();
    harness.restore();
  }
});

test('custom editor clamps manually configured preview lines above the maximum', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('clamped-settings.json', '{"a":1}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    harness.fake.previewLines = 10001;
    const provider = activateAndGetProvider(harness);
    const document = await provider.openCustomDocument(FakeUri.file(filePath));
    await provider.resolveCustomEditor(document, panel, {});

    panel.webview.receive({ type: 'ready' });
    const data = await waitForMessage<{
      readonly type?: unknown;
      readonly payload: { readonly previewLines: number };
    }>(panel, (message) => message.type === 'data');

    assert.equal(data.payload.previewLines, 10000);
  } finally {
    panel.dispose();
    harness.restore();
  }
});

test('custom editor reports setting update failures', async () => {
  const harness = loadExtension();
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.configurationUpdateError = new Error('settings failed');
    const provider = activateAndGetProvider(harness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('settings-fail.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, panel, {});

    panel.webview.receive({ type: 'updatePreviewLines', value: 8 });
    const settingsError = await waitForMessage<{
      readonly type?: unknown;
      readonly message: string;
    }>(panel, (message) => message.type === 'previewLinesError');
    assert.equal(settingsError.message, 'settings failed');
  } finally {
    panel.dispose();
    harness.restore();
  }
});

test('custom editor reloads on settings and matching file saves', async () => {
  const harness = loadExtension();
  const filePath = await writeFixture('reload.json', '{"a":1}\n{"b":2}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(filePath);
    const document = await provider.openCustomDocument(uri);
    await provider.resolveCustomEditor(document, panel, {});
    panel.webview.receive({ type: 'ready' });
    await waitForMessage(panel, (message) => message.type === 'data');

    panel.webview.messages.length = 0;
    harness.fake.fireConfigurationChange(['quickJsonViewer.previewLines']);
    await waitForMessage(panel, (message) => message.type === 'loading');

    panel.webview.messages.length = 0;
    harness.fake.fireSave(uri);
    harness.fake.fireSave(uri);
    await waitForMessage(panel, (message) => message.type === 'loading', 1_000);

    const listenerCount = harness.fake.saveListeners.length;
    panel.dispose();
    assert.ok(
      harness.fake.saveListeners
        .slice(0, listenerCount)
        .every((item) => item.disposed)
    );
  } finally {
    harness.restore();
  }
});

test('native file watcher filters events and disposes pending reloads', async () => {
  let watchCallback:
    | ((_eventType: string, changedFileName?: string | Buffer) => void)
    | undefined;
  let watchErrorCallback: (() => void) | undefined;
  let closeCalls = 0;
  const harness = loadExtension(
    {},
    {
      watch: (
        _directory: string,
        callback: (
          _eventType: string,
          changedFileName?: string | Buffer
        ) => void
      ) => {
        watchCallback = callback;
        return {
          on: (eventName: string, listener: () => void) => {
            if (eventName === 'error') {
              watchErrorCallback = listener;
            }
          },
          close: () => {
            closeCalls += 1;
          }
        };
      }
    }
  );
  const filePath = await writeFixture('watched.json', '{"a":1}\n{"b":2}');
  const panel = new FakeWebviewPanel();
  try {
    harness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(harness);
    const uri = FakeUri.file(filePath);
    const document = await provider.openCustomDocument(uri);
    await provider.resolveCustomEditor(document, panel, {});
    assert.ok(watchCallback);
    assert.ok(watchErrorCallback);
    watchErrorCallback();

    watchCallback?.('change');
    assert.equal(panel.webview.messages.length, 0);

    panel.webview.receive({ type: 'ready' });
    await waitForMessage(panel, (message) => message.type === 'data');

    panel.webview.messages.length = 0;
    watchCallback?.('change', 'other.json');
    await sleep(200);
    assert.equal(
      panel.webview.messages.some(
        (message) => getMessageType(message) === 'loading'
      ),
      false
    );

    watchCallback?.('change', Buffer.from(path.basename(filePath)));
    await waitForMessage(panel, (message) => message.type === 'loading');
    await waitForMessage(panel, (message) => message.type === 'data');

    watchCallback?.('change', Buffer.from(path.basename(filePath)));
    panel.dispose();
    assert.equal(closeCalls, 1);
  } finally {
    harness.restore();
  }
});

test('custom editor reports unsupported schemes and missing files', async () => {
  const harness = loadExtension();
  try {
    const provider = activateAndGetProvider(harness);

    const unsupportedPanel = new FakeWebviewPanel();
    const unsupported = await provider.openCustomDocument(
      new FakeUri('/remote/data.json', 'vscode-remote')
    );
    await provider.resolveCustomEditor(unsupported, unsupportedPanel, {});
    unsupportedPanel.webview.receive({ type: 'ready' });
    const unsupportedError = await waitForMessage<{
      readonly type?: unknown;
      readonly message: string;
    }>(unsupportedPanel, (message) => message.type === 'error');
    assert.match(
      unsupportedError.message,
      /Unsupported URI scheme: vscode-remote/
    );
    unsupportedPanel.dispose();

    const missingPanel = new FakeWebviewPanel();
    const missing = await provider.openCustomDocument(
      FakeUri.file(path.join(tempDir, 'does-not-exist.json'))
    );
    await provider.resolveCustomEditor(missing, missingPanel, {});
    missingPanel.webview.receive({ type: 'ready' });
    const missingError = await waitForMessage<{
      readonly type?: unknown;
      readonly message: string;
    }>(missingPanel, (message) => message.type === 'error');
    assert.match(missingError.message, /ENOENT/);
    missingPanel.dispose();
  } finally {
    harness.restore();
  }
});

test('custom editor tolerates native watcher setup failures and safeLoad errors', async () => {
  const watchHarness = loadExtension(
    {},
    {
      watch: () => {
        throw new Error('watch unavailable');
      }
    }
  );
  const watchPanel = new FakeWebviewPanel();
  try {
    watchHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(watchHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('watch-fails.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, watchPanel, {});
    watchPanel.webview.receive({ type: 'ready' });
    await waitForMessage(watchPanel, (message) => message.type === 'data');
  } finally {
    watchPanel.dispose();
    watchHarness.restore();
  }

  const safeHarness = loadExtension();
  const safePanel = new FakeWebviewPanel();
  const originalPostMessage = safePanel.webview.postMessage.bind(
    safePanel.webview
  );
  try {
    safePanel.webview.postMessage = async (
      message: unknown
    ): Promise<boolean> => {
      if (getMessageType(message) === 'loading') {
        throw 'load failed';
      }

      return originalPostMessage(message);
    };
    const provider = activateAndGetProvider(safeHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('safe-load-fails.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, safePanel, {});

    safePanel.webview.receive({ type: 'ready' });
    const error = await waitForMessage<{
      readonly type?: unknown;
      readonly message: string;
    }>(safePanel, (message) => message.type === 'error');
    assert.equal(error.message, 'load failed');
  } finally {
    safePanel.dispose();
    safeHarness.restore();
  }
});

test('custom editor drops stale preview results and ignores aborted reads', async () => {
  const previewResolvers: Array<
    (preview: {
      readonly lines: unknown[];
      readonly loadedLineCount: number;
      readonly displayLimit: number;
      readonly truncatedLineCount: number;
      readonly truncatedByLineLimit: boolean;
    }) => void
  > = [];
  const staleHarness = loadExtension({
    readJsonPreview: async () =>
      new Promise((resolve) => {
        previewResolvers.push(resolve);
      })
  });
  const stalePanel = new FakeWebviewPanel();
  try {
    staleHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(staleHarness);
    const uri = FakeUri.file(
      await writeFixture('stale-preview.json', '{"a":1}\n{"b":2}')
    );
    const document = await provider.openCustomDocument(uri);
    await provider.resolveCustomEditor(document, stalePanel, {});
    stalePanel.webview.receive({ type: 'ready' });
    await waitForMessage(
      stalePanel,
      (message) => message.type === 'previewLoadStart'
    );

    staleHarness.fake.fireConfigurationChange(['quickJsonViewer.previewLines']);
    await waitFor(() => previewResolvers.length === 2);
    previewResolvers[0]?.({
      lines: [],
      loadedLineCount: 0,
      displayLimit: 100,
      truncatedLineCount: 0,
      truncatedByLineLimit: false
    });
    await sleep(50);
    assert.equal(
      stalePanel.webview.messages.some(
        (message) => getMessageType(message) === 'data'
      ),
      false
    );
  } finally {
    stalePanel.dispose();
    staleHarness.restore();
  }

  const abortHarness = loadExtension({
    readJsonPreview: async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
  });
  const abortPanel = new FakeWebviewPanel();
  try {
    abortHarness.fake.largeFileThresholdMb = 0;
    const provider = activateAndGetProvider(abortHarness);
    const document = await provider.openCustomDocument(
      FakeUri.file(await writeFixture('abort-preview.json', '{"a":1}'))
    );
    await provider.resolveCustomEditor(document, abortPanel, {});
    abortPanel.webview.receive({ type: 'ready' });
    await waitForMessage(
      abortPanel,
      (message) => message.type === 'previewLoadStart'
    );
    await sleep(20);
    assert.equal(
      abortPanel.webview.messages.some(
        (message) => getMessageType(message) === 'error'
      ),
      false
    );
  } finally {
    abortPanel.dispose();
    abortHarness.restore();
  }
});
