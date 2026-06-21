import * as nodeFs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { FILE_RELOAD_DEBOUNCE_MS, SETTINGS_SECTION } from './constants';
import { getHtml } from './webview/html';
import {
  ExactLineCountCache,
  ExactLineCountRequest,
  FileSnapshot,
  isSameFileSnapshot,
  postJsonData,
  startExactLineCount
} from './viewerData';
import { WebviewMessage, formatError, getSettings } from './viewerProtocol';
import {
  MAX_PREVIEW_LINES,
  PREVIEW_LINES_ERROR_MESSAGE
} from './shared/settings';

export class JsonDocument implements vscode.CustomDocument {
  public constructor(public readonly uri: vscode.Uri) {}

  public dispose(): void {
    // No document-level resources are held.
  }
}

export class JsonViewerProvider implements vscode.CustomReadonlyEditorProvider<JsonDocument> {
  public async openCustomDocument(uri: vscode.Uri): Promise<JsonDocument> {
    return new JsonDocument(uri);
  }

  public async resolveCustomEditor(
    document: JsonDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true
    };
    webviewPanel.webview.html = getHtml(path.basename(document.uri.fsPath));
    webviewPanel.reveal(webviewPanel.viewColumn, false);

    const disposables: vscode.Disposable[] = [];
    let generation = 0;
    let webviewReady = false;
    let abortController: AbortController | undefined;
    let fileReloadTimer: ReturnType<typeof setTimeout> | undefined;
    let currentFileSnapshot: FileSnapshot | undefined;
    let exactLineCountCache: ExactLineCountCache | undefined;
    let exactLineCountRequest: ExactLineCountRequest | undefined;
    let disposed = false;

    const cancelCurrentWork = (): void => {
      abortController?.abort();
      abortController = undefined;
    };

    const abortExactLineCount = (): void => {
      exactLineCountRequest?.controller.abort();
      exactLineCountRequest = undefined;
    };

    const invalidateExactLineCount = (): void => {
      abortExactLineCount();
      exactLineCountCache = undefined;
    };

    const noteFileSnapshot = (snapshot: FileSnapshot): void => {
      if (
        currentFileSnapshot &&
        isSameFileSnapshot(currentFileSnapshot, snapshot)
      ) {
        return;
      }

      invalidateExactLineCount();
      currentFileSnapshot = snapshot;
    };

    const getCachedLineCount = (snapshot: FileSnapshot): number | undefined =>
      exactLineCountCache &&
      isSameFileSnapshot(exactLineCountCache.snapshot, snapshot)
        ? exactLineCountCache.lineCount
        : undefined;

    const setCachedLineCount = (
      snapshot: FileSnapshot,
      lineCount: number
    ): void => {
      exactLineCountCache = {
        snapshot,
        lineCount
      };

      if (
        exactLineCountRequest &&
        isSameFileSnapshot(exactLineCountRequest.snapshot, snapshot)
      ) {
        exactLineCountRequest.controller.abort();
        exactLineCountRequest = undefined;
      }
    };

    const clearExactLineCountRequest = (snapshot: FileSnapshot): void => {
      if (
        exactLineCountRequest &&
        isSameFileSnapshot(exactLineCountRequest.snapshot, snapshot)
      ) {
        exactLineCountRequest = undefined;
      }
    };

    const ensureExactLineCount = (snapshot: FileSnapshot): void => {
      if (getCachedLineCount(snapshot) !== undefined) {
        return;
      }

      if (
        exactLineCountRequest &&
        isSameFileSnapshot(exactLineCountRequest.snapshot, snapshot)
      ) {
        return;
      }

      abortExactLineCount();
      const controller = new AbortController();
      exactLineCountRequest = {
        snapshot,
        controller
      };

      startExactLineCount(
        document.uri.fsPath,
        webviewPanel.webview,
        snapshot,
        () => currentFileSnapshot,
        controller.signal,
        setCachedLineCount,
        clearExactLineCountRequest
      );
    };

    const openDefaultEditor = async (): Promise<void> => {
      if (disposed) {
        return;
      }

      await vscode.commands.executeCommand(
        'vscode.openWith',
        document.uri,
        'default',
        webviewPanel.viewColumn ?? vscode.ViewColumn.Active
      );
      webviewPanel.dispose();
    };

    const load = async (): Promise<void> => {
      cancelCurrentWork();
      const currentGeneration = ++generation;
      const controller = new AbortController();
      abortController = controller;

      await postJsonData(
        document.uri,
        webviewPanel.webview,
        currentGeneration,
        () => generation,
        controller.signal,
        getSettings(),
        openDefaultEditor,
        {
          noteFileSnapshot,
          getCachedLineCount,
          setCachedLineCount,
          ensureExactLineCount
        }
      );
    };

    const safeLoad = (): void => {
      if (!webviewReady || disposed) {
        return;
      }

      void load().catch(async (error: unknown) => {
        await webviewPanel.webview.postMessage({
          type: 'error',
          message: formatError(error)
        });
      });
    };

    const scheduleFileReload = (): void => {
      if (!webviewReady || disposed) {
        return;
      }

      invalidateExactLineCount();

      if (fileReloadTimer) {
        clearTimeout(fileReloadTimer);
      }

      fileReloadTimer = setTimeout(() => {
        fileReloadTimer = undefined;
        safeLoad();
      }, FILE_RELOAD_DEBOUNCE_MS);
    };

    const updatePreviewLines = async (
      message: WebviewMessage
    ): Promise<void> => {
      const value =
        typeof message.value === 'number' ? message.value : Number.NaN;
      if (!Number.isInteger(value) || value < 1 || value > MAX_PREVIEW_LINES) {
        await webviewPanel.webview.postMessage({
          type: 'previewLinesError',
          message: PREVIEW_LINES_ERROR_MESSAGE
        });
        return;
      }

      await vscode.workspace
        .getConfiguration(SETTINGS_SECTION)
        .update('previewLines', value, vscode.ConfigurationTarget.Global);
    };

    disposables.push(
      webviewPanel.webview.onDidReceiveMessage((message: WebviewMessage) => {
        if (message.type === 'ready') {
          webviewReady = true;
          safeLoad();
          return;
        }

        if (message.type === 'updatePreviewLines') {
          void updatePreviewLines(message).catch(async (error: unknown) => {
            await webviewPanel.webview.postMessage({
              type: 'previewLinesError',
              message: formatError(error)
            });
          });
          return;
        }

        if (message.type === 'showRawJson') {
          void openDefaultEditor().catch(async (error: unknown) => {
            await webviewPanel.webview.postMessage({
              type: 'error',
              message: formatError(error)
            });
          });
        }
      })
    );

    disposables.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (
          event.affectsConfiguration(
            `${SETTINGS_SECTION}.largeFileThresholdMb`
          ) ||
          event.affectsConfiguration(`${SETTINGS_SECTION}.previewLines`)
        ) {
          safeLoad();
        }
      })
    );

    disposables.push(
      vscode.workspace.onDidSaveTextDocument((textDocument) => {
        if (textDocument.uri.toString() === document.uri.toString()) {
          scheduleFileReload();
        }
      })
    );

    if (document.uri.scheme === 'file') {
      try {
        const directoryWatcher = nodeFs.watch(
          path.dirname(document.uri.fsPath),
          (_eventType, changedFileName) => {
            const changedName = changedFileName
              ? changedFileName.toString()
              : undefined;
            if (
              !changedName ||
              changedName === path.basename(document.uri.fsPath)
            ) {
              scheduleFileReload();
            }
          }
        );
        directoryWatcher.on('error', () => {
          // Save events still cover VS Code edits when native watching fails.
        });
        disposables.push({
          dispose: () => {
            directoryWatcher.close();
          }
        });
      } catch {
        // Some filesystems do not support native watching; save events still reload VS Code edits.
      }
    }

    webviewPanel.onDidDispose(() => {
      disposed = true;
      cancelCurrentWork();
      currentFileSnapshot = undefined;
      abortExactLineCount();
      if (fileReloadTimer) {
        clearTimeout(fileReloadTimer);
      }
      for (const disposable of disposables) {
        disposable.dispose();
      }
    });

    safeLoad();
  }
}
