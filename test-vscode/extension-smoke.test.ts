import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

suite('Quick JSON Viewer VS Code smoke tests', function () {
  this.timeout(10_000);

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('auto-opens a JSON fixture above the threshold with the readonly custom viewer', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace
      .getConfiguration('quickJsonViewer')
      .update('largeFileThresholdMb', 0, vscode.ConfigurationTarget.Global);

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'quick-json-viewer-smoke-')
    );
    const filePath = path.join(tempDir, 'fixture.json');
    await fs.writeFile(filePath, '{"a":1}\n{"b":2}', 'utf8');
    const uri = vscode.Uri.file(filePath);

    await vscode.commands.executeCommand('vscode.open', uri);

    await waitFor(() => {
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      return (
        input instanceof vscode.TabInputCustom &&
        input.uri.toString() === uri.toString()
      );
    });

    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    assert.ok(input instanceof vscode.TabInputCustom);
    assert.equal(input.uri.toString(), uri.toString());
  });

  test('extension activates and contributes expected commands', async () => {
    const extension = vscode.extensions.getExtension('jsh9.quick-json-viewer');
    assert.ok(extension);

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('quickJsonViewer.openCurrentFile'));
    assert.ok(commands.includes('quickJsonViewer.openSampleFiles'));
  });

  test('opens JSON diffs with VS Code text diff editor', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await vscode.workspace
      .getConfiguration('quickJsonViewer')
      .update('largeFileThresholdMb', 0, vscode.ConfigurationTarget.Global);

    const tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'quick-json-viewer-diff-smoke-')
    );
    const originalPath = path.join(tempDir, 'original.json');
    const modifiedPath = path.join(tempDir, 'modified.json');
    await fs.writeFile(originalPath, '{"a":1}\n', 'utf8');
    await fs.writeFile(modifiedPath, '{"a":2}\n', 'utf8');

    const originalUri = vscode.Uri.file(originalPath);
    const modifiedUri = vscode.Uri.file(modifiedPath);
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      modifiedUri,
      'JSON diff'
    );

    await waitFor(() => {
      const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
      return (
        input instanceof vscode.TabInputTextDiff &&
        input.original.toString() === originalUri.toString() &&
        input.modified.toString() === modifiedUri.toString()
      );
    });

    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    assert.ok(!(input instanceof vscode.TabInputCustom));
    assert.ok(input instanceof vscode.TabInputTextDiff);
  });
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 5_000
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for VS Code smoke-test condition.');
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
