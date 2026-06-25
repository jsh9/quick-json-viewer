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
  sleep,
  tempDir,
  thisOwner,
  waitFor,
  writeFixture
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

test('openCurrentFile resolves active editor and custom tab URIs', async () => {
  const harness = loadExtension();
  try {
    harness.extension.activate(createContext());
    const openCurrentFile = getCommand(
      harness.fake,
      'quickJsonViewer.openCurrentFile'
    );
    const textUri = FakeUri.file(path.join(tempDir, 'active.json'));
    const customUri = FakeUri.file(path.join(tempDir, 'custom.json'));

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
  } finally {
    thisOwner.activeTextEditorUri = undefined;
    thisOwner.activeTabInput = undefined;
    harness.restore();
  }
});

test('openCurrentFile refuses active diff tabs', async () => {
  const harness = loadExtension();
  try {
    harness.extension.activate(createContext());
    const openCurrentFile = getCommand(
      harness.fake,
      'quickJsonViewer.openCurrentFile'
    );
    const modifiedUri = FakeUri.file(path.join(tempDir, 'modified.json'));

    harness.fake.activeTextEditorUri = modifiedUri;
    thisOwner.activeTextEditorUri = modifiedUri;
    harness.fake.activeTabInput = new FakeTabInputTextDiff(
      FakeUri.file(path.join(tempDir, 'original.json')),
      modifiedUri
    );
    thisOwner.activeTabInput = harness.fake.activeTabInput;

    await openCurrentFile();

    assert.equal(harness.fake.executedCommands.length, 0);
    assert.equal(
      harness.fake.warnings.at(-1),
      'Quick JSON Viewer cannot open JSON diff editors. Open one side of the diff as a normal file first.'
    );
  } finally {
    thisOwner.activeTextEditorUri = undefined;
    thisOwner.activeTabInput = undefined;
    harness.restore();
  }
});

test('active normal JSON editors auto-open above threshold while diff tabs stay text diffs', async () => {
  const harness = loadExtension();
  try {
    harness.fake.largeFileThresholdMb = 0;
    harness.extension.activate(createContext());
    const jsonUri = FakeUri.file(
      await writeFixture('auto-open.json', '{"a":1}')
    );

    harness.fake.fireActiveTextEditor(jsonUri);
    await waitFor(() => harness.fake.executedCommands.length === 1);
    assert.deepEqual(harness.fake.executedCommands.at(-1), {
      command: 'vscode.openWith',
      args: [jsonUri, 'quickJsonViewer.viewer', FakeVscode.ViewColumn.One]
    });

    harness.fake.executedCommands.length = 0;
    harness.fake.activeTabInput = new FakeTabInputTextDiff(
      FakeUri.file(path.join(tempDir, 'original.json')),
      jsonUri
    );
    thisOwner.activeTabInput = harness.fake.activeTabInput;

    harness.fake.fireActiveTextEditor(jsonUri);
    await sleep(20);
    assert.equal(harness.fake.executedCommands.length, 0);
  } finally {
    thisOwner.activeTextEditorUri = undefined;
    thisOwner.activeTabInput = undefined;
    harness.restore();
  }
});

test('opened normal JSON documents auto-open after activation even without active-editor events', async () => {
  const harness = loadExtension();
  try {
    harness.fake.largeFileThresholdMb = 0;
    harness.extension.activate(createContext());
    const jsonUri = FakeUri.file(
      await writeFixture('auto-open-after-activation.json', '{"a":1}')
    );

    harness.fake.activeTextEditorUri = jsonUri;
    thisOwner.activeTextEditorUri = jsonUri;
    harness.fake.fireOpen(jsonUri);

    await waitFor(() => harness.fake.executedCommands.length === 1, 1_000);
    assert.deepEqual(harness.fake.executedCommands.at(-1), {
      command: 'vscode.openWith',
      args: [jsonUri, 'quickJsonViewer.viewer', FakeVscode.ViewColumn.One]
    });
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
