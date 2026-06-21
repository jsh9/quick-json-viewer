import type * as nodeFs from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  JsonPreview,
  ViewerSettings,
  countJsonLines,
  formatFileSize,
  getThresholdBytes,
  isAbortError,
  readJsonPreview,
  shouldPreviewFile
} from './json';
import { formatError } from './viewerProtocol';

export interface JsonDataPayload {
  readonly fileName: string;
  readonly fileSize: string;
  readonly fileSizeBytes: number;
  readonly lastModified: string;
  readonly largeFileThresholdMb: number;
  readonly thresholdBytes: number;
  readonly previewLines: number;
  readonly maxAllowablePreviewLines: number;
  readonly lineCount: number | null;
  readonly preview: JsonPreview;
}

export interface FileSnapshot {
  readonly size: number;
  readonly mtimeMs: number;
}

export interface ExactLineCountCache {
  readonly snapshot: FileSnapshot;
  readonly lineCount: number;
}

export interface ExactLineCountRequest {
  readonly snapshot: FileSnapshot;
  readonly controller: AbortController;
}

export interface ExactLineCountCoordinator {
  readonly noteFileSnapshot: (snapshot: FileSnapshot) => void;
  readonly getCachedLineCount: (snapshot: FileSnapshot) => number | undefined;
  readonly setCachedLineCount: (
    snapshot: FileSnapshot,
    lineCount: number
  ) => void;
  readonly ensureExactLineCount: (snapshot: FileSnapshot) => void;
}

export async function postJsonData(
  uri: vscode.Uri,
  webview: vscode.Webview,
  generation: number,
  getLatestGeneration: () => number,
  signal: AbortSignal,
  settings: ViewerSettings,
  openDefaultEditor: () => Promise<void>,
  exactLineCounts: ExactLineCountCoordinator
): Promise<void> {
  if (uri.scheme !== 'file') {
    await webview.postMessage({
      type: 'error',
      message: `Quick JSON Viewer only supports file-backed JSON documents. Unsupported URI scheme: ${uri.scheme}.`
    });
    return;
  }

  await webview.postMessage({ type: 'loading' });

  try {
    const stats = await fs.stat(uri.fsPath);
    const snapshot = getFileSnapshot(stats);
    exactLineCounts.noteFileSnapshot(snapshot);
    if (generation !== getLatestGeneration()) {
      return;
    }

    if (!shouldPreviewFile(stats.size, settings)) {
      await openDefaultEditor();
      return;
    }

    const metadata = {
      fileName: path.basename(uri.fsPath),
      fileSize: formatFileSize(stats.size),
      fileSizeBytes: stats.size,
      lastModified: stats.mtime.toLocaleString(),
      largeFileThresholdMb: settings.largeFileThresholdMb,
      thresholdBytes: getThresholdBytes(settings.largeFileThresholdMb),
      previewLines: settings.previewLines,
      maxAllowablePreviewLines: settings.maxAllowablePreviewLines,
      lineCount: exactLineCounts.getCachedLineCount(snapshot) ?? null
    };

    await webview.postMessage({
      type: 'previewLoadStart',
      payload: metadata
    });

    const preview = await readJsonPreview(uri.fsPath, settings, { signal });
    if (generation !== getLatestGeneration()) {
      return;
    }

    await webview.postMessage({
      type: 'data',
      payload: {
        ...metadata,
        preview
      } satisfies JsonDataPayload
    });

    exactLineCounts.ensureExactLineCount(snapshot);
  } catch (error) {
    if (generation !== getLatestGeneration()) {
      return;
    }

    if (isAbortError(error)) {
      return;
    }

    await webview.postMessage({
      type: 'error',
      message: formatError(error)
    });
  }
}

export function startExactLineCount(
  filePath: string,
  webview: vscode.Webview,
  snapshot: FileSnapshot,
  getCurrentFileSnapshot: () => FileSnapshot | undefined,
  signal: AbortSignal,
  setCachedLineCount: (snapshot: FileSnapshot, lineCount: number) => void,
  clearExactLineCountRequest: (snapshot: FileSnapshot) => void
): void {
  const isCurrentSnapshot = (): boolean => {
    const currentSnapshot = getCurrentFileSnapshot();
    return Boolean(
      currentSnapshot && isSameFileSnapshot(currentSnapshot, snapshot)
    );
  };

  void countJsonLines(filePath, {
    signal,
    onProgress: (progress) => {
      if (!isCurrentSnapshot()) {
        return;
      }

      void webview.postMessage({
        type: 'lineCountProgress',
        payload: progress
      });
    }
  })
    .then(async (lineCount) => {
      if (!isCurrentSnapshot() || signal.aborted) {
        return;
      }

      setCachedLineCount(snapshot, lineCount);
      await webview.postMessage({
        type: 'lineCount',
        lineCount
      });
    })
    .catch(async (error: unknown) => {
      if (!isCurrentSnapshot() || isAbortError(error)) {
        return;
      }

      await webview.postMessage({
        type: 'lineCountError',
        message: formatError(error)
      });
    })
    .finally(() => {
      clearExactLineCountRequest(snapshot);
    });
}

export function getFileSnapshot(
  stats: Pick<nodeFs.Stats, 'size' | 'mtimeMs'>
): FileSnapshot {
  return {
    size: stats.size,
    mtimeMs: stats.mtimeMs
  };
}

export function isSameFileSnapshot(
  left: FileSnapshot,
  right: FileSnapshot
): boolean {
  return left.size === right.size && left.mtimeMs === right.mtimeMs;
}
