import * as assert from 'node:assert/strict';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  FakeTabInputCustom,
  FakeTabInputText,
  FakeTabInputTextDiff,
  FakeUri,
  FakeVscode,
  createContext,
  getCommand,
  loadExtension,
  tempDir,
  thisOwner,
  waitFor
} from './support/extensionHarness';

test('openCurrentFile validates input and opens JSON resources', async () => {
  const harness = loadExtension();
  try {
    harness.extension.activate(createContext());
    const openCurrentFile = getCommand(
      harness.fake,
      'quickJsonViewer.openCurrentFile'
    );
    const jsonUri = FakeUri.file(path.join(tempDir, 'direct.json'));

    await openCurrentFile();
    assert.equal(
      harness.fake.warnings.at(-1),
      'Open a JSON file before running Quick JSON Viewer.'
    );

    await openCurrentFile(FakeUri.file(path.join(tempDir, 'not-json.txt')));
    assert.equal(
      harness.fake.warnings.at(-1),
      'Quick JSON Viewer can only open .json files.'
    );

    await openCurrentFile(
      new FakeUri(path.join(tempDir, 'remote.json'), 'untitled')
    );
    assert.equal(
      harness.fake.warnings.at(-1),
      'Quick JSON Viewer can only open .json files.'
    );

    await openCurrentFile(jsonUri);
    assert.deepEqual(harness.fake.executedCommands.at(-1), {
      command: 'vscode.openWith',
      args: [jsonUri, 'quickJsonViewer.viewer', FakeVscode.ViewColumn.Active]
    });
  } finally {
    harness.restore();
  }
});

test('openCurrentFile resolves active editor, custom tab, and diff tab URIs', async () => {
  const harness = loadExtension();
  try {
    harness.extension.activate(createContext());
    const openCurrentFile = getCommand(
      harness.fake,
      'quickJsonViewer.openCurrentFile'
    );
    const textUri = FakeUri.file(path.join(tempDir, 'active.json'));
    const customUri = FakeUri.file(path.join(tempDir, 'custom.json'));
    const modifiedUri = FakeUri.file(path.join(tempDir, 'modified.json'));

    harness.fake.activeTextEditorUri = textUri;
    thisOwner.activeTextEditorUri = textUri;
    await openCurrentFile();
    assert.equal(harness.fake.executedCommands.at(-1)?.args[0], textUri);

    harness.fake.activeTextEditorUri = undefined;
    thisOwner.activeTextEditorUri = undefined;
    harness.fake.activeTabInput = new FakeTabInputText(textUri);
    thisOwner.activeTabInput = harness.fake.activeTabInput;
    await openCurrentFile();
    assert.equal(harness.fake.executedCommands.at(-1)?.args[0], textUri);

    harness.fake.activeTabInput = new FakeTabInputCustom(customUri);
    thisOwner.activeTabInput = harness.fake.activeTabInput;
    await openCurrentFile();
    assert.equal(harness.fake.executedCommands.at(-1)?.args[0], customUri);

    harness.fake.activeTabInput = new FakeTabInputTextDiff(
      FakeUri.file(path.join(tempDir, 'original.json')),
      modifiedUri
    );
    thisOwner.activeTabInput = harness.fake.activeTabInput;
    await openCurrentFile();
    assert.equal(harness.fake.executedCommands.at(-1)?.args[0], modifiedUri);
  } finally {
    thisOwner.activeTextEditorUri = undefined;
    thisOwner.activeTabInput = undefined;
    harness.restore();
  }
});

test('command handlers report async open failures', async () => {
  const harness = loadExtension();
  try {
    harness.extension.activate(createContext());
    harness.fake.executeCommandError = new Error('open failed');

    await getCommand(
      harness.fake,
      'quickJsonViewer.openCurrentFile'
    )(FakeUri.file(path.join(tempDir, 'failure.json')));
    await waitFor(() => harness.fake.errors.length === 1);
    assert.equal(
      harness.fake.errors[0],
      'Quick JSON Viewer failed to open the file: open failed'
    );

    await getCommand(harness.fake, 'quickJsonViewer.openSampleFiles')();
    await waitFor(() => harness.fake.errors.length === 2);
    assert.equal(
      harness.fake.errors[1],
      'Quick JSON Viewer failed to open sample files: open failed'
    );
  } finally {
    harness.restore();
  }
});

test('openSampleFiles opens bundled samples in the intended columns', async () => {
  const harness = loadExtension();
  try {
    const extensionUri = FakeUri.file(path.join(tempDir, 'extension-root'));
    harness.extension.activate(createContext(extensionUri));

    await getCommand(harness.fake, 'quickJsonViewer.openSampleFiles')();

    assert.equal(harness.fake.executedCommands.length, 2);
    assert.deepEqual(
      harness.fake.executedCommands.map((event) => event.command),
      ['vscode.openWith', 'vscode.openWith']
    );
    assert.equal(
      (harness.fake.executedCommands[0]?.args[0] as FakeUri).fsPath,
      path.join(extensionUri.fsPath, 'sample-data', 'sample-data.json')
    );
    assert.equal(
      harness.fake.executedCommands[0]?.args[2],
      FakeVscode.ViewColumn.One
    );
    assert.equal(
      (harness.fake.executedCommands[1]?.args[0] as FakeUri).fsPath,
      path.join(extensionUri.fsPath, 'sample-data', 'large-placeholder.json')
    );
    assert.equal(
      harness.fake.executedCommands[1]?.args[2],
      FakeVscode.ViewColumn.Beside
    );
  } finally {
    harness.restore();
  }
});
