import * as path from 'node:path';
import * as vscode from 'vscode';
import { SAMPLE_JSON_PATHS, VIEW_TYPE } from './constants';

const DIFF_EDITOR_WARNING =
  'Quick JSON Viewer is not available in diff editors.';

export async function openJsonViewer(resource?: vscode.Uri): Promise<void> {
  if (!resource && isActiveTextDiffEditor()) {
    void vscode.window.showWarningMessage(DIFF_EDITOR_WARNING);
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

function getActiveEditorUri(): vscode.Uri | undefined {
  const activeTextEditorUri = vscode.window.activeTextEditor?.document.uri;

  if (activeTextEditorUri) {
    return activeTextEditorUri;
  }

  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;

  if (
    input instanceof vscode.TabInputText ||
    input instanceof vscode.TabInputCustom
  ) {
    return input.uri;
  }

  return undefined;
}

function isActiveTextDiffEditor(): boolean {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputTextDiff;
}

function isJsonFile(uri: vscode.Uri): boolean {
  return (
    uri.scheme === 'file' && path.extname(uri.fsPath).toLowerCase() === '.json'
  );
}
