import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { SAMPLE_JSON_PATHS, VIEW_TYPE } from './constants';
import { shouldPreviewFile } from './json';
import { getSettings } from './viewerProtocol';

const suppressedJsonAutoOpenUris = new Set<string>();
const pendingJsonAutoOpenUris = new Set<string>();
const autoOpenedJsonViewerUris = new Set<string>();

export async function openJsonViewer(resource?: vscode.Uri): Promise<void> {
  if (!resource && isActiveDiffTab()) {
    void vscode.window.showWarningMessage(
      'Quick JSON Viewer cannot open JSON diff editors. Open one side of the diff as a normal file first.'
    );
    return;
  }

  const uri = resource ?? getActiveEditorUri();

  if (!uri) {
    void vscode.window.showWarningMessage(
      'Open a JSON file before running Quick JSON Viewer.'
    );
    return;
  }

  if (!isJsonFile(uri)) {
    void vscode.window.showWarningMessage(
      'Quick JSON Viewer can only open .json files.'
    );
    return;
  }

  allowJsonAutoOpen(uri);

  await vscode.commands.executeCommand(
    'vscode.openWith',
    uri,
    VIEW_TYPE,
    vscode.ViewColumn.Active
  );
}

export async function openSampleJsonFiles(
  extensionUri: vscode.Uri
): Promise<void> {
  for (const [index, relativePath] of SAMPLE_JSON_PATHS.entries()) {
    const uri = vscode.Uri.joinPath(extensionUri, ...relativePath.split('/'));
    const column =
      index === 0 ? vscode.ViewColumn.One : vscode.ViewColumn.Beside;
    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      VIEW_TYPE,
      column
    );
  }
}

export async function autoOpenJsonViewerForTextEditor(
  editor: vscode.TextEditor | undefined
): Promise<void> {
  if (!editor || isActiveDiffTab()) {
    return;
  }

  const uri = editor.document.uri;
  const uriKey = uri.toString();

  if (
    !isJsonFile(uri) ||
    suppressedJsonAutoOpenUris.has(uriKey) ||
    pendingJsonAutoOpenUris.has(uriKey) ||
    autoOpenedJsonViewerUris.has(uriKey)
  ) {
    return;
  }

  pendingJsonAutoOpenUris.add(uriKey);
  try {
    const stats = await fs.stat(uri.fsPath).catch(() => undefined);
    if (!stats || !shouldPreviewFile(stats.size, getSettings())) {
      return;
    }

    if (
      isActiveDiffTab() ||
      suppressedJsonAutoOpenUris.has(uriKey) ||
      vscode.window.activeTextEditor?.document.uri.toString() !== uriKey
    ) {
      return;
    }

    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      VIEW_TYPE,
      editor.viewColumn ?? vscode.ViewColumn.Active
    );
    autoOpenedJsonViewerUris.add(uriKey);
  } finally {
    pendingJsonAutoOpenUris.delete(uriKey);
  }
}

export function suppressJsonAutoOpen(uri: vscode.Uri): void {
  suppressedJsonAutoOpenUris.add(uri.toString());
}

export function allowJsonAutoOpen(uri: vscode.Uri): void {
  const uriKey = uri.toString();
  suppressedJsonAutoOpenUris.delete(uriKey);
  autoOpenedJsonViewerUris.delete(uriKey);
}

export function forgetJsonAutoOpen(uri: vscode.Uri): void {
  autoOpenedJsonViewerUris.delete(uri.toString());
}

function getActiveEditorUri(): vscode.Uri | undefined {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;

  if (input instanceof vscode.TabInputTextDiff) {
    return undefined;
  }

  const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri;

  if (activeTextEditorUri) {
    return activeTextEditorUri;
  }

  if (
    input instanceof vscode.TabInputText ||
    input instanceof vscode.TabInputCustom
  ) {
    return input.uri;
  }
  return undefined;
}

function isJsonFile(uri: vscode.Uri): boolean {
  return (
    uri.scheme === 'file' && path.extname(uri.fsPath).toLowerCase() === '.json'
  );
}

function isActiveDiffTab(): boolean {
  return (
    vscode.window.tabGroups.activeTabGroup.activeTab?.input instanceof
    vscode.TabInputTextDiff
  );
}
