import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContext, loadExtension } from './support/extensionHarness';

test('activate registers commands, auto-open listeners, and the readonly custom editor provider', () => {
  const harness = loadExtension();
  try {
    const context = createContext();

    harness.extension.activate(context);

    assert.equal(context.subscriptions.length, 6);
    assert.ok(
      harness.fake.registeredCommands.has('quickJsonViewer.openCurrentFile')
    );
    assert.ok(
      harness.fake.registeredCommands.has('quickJsonViewer.openSampleFiles')
    );
    assert.equal(harness.fake.activeTextEditorListeners.length, 1);
    assert.equal(harness.fake.openListeners.length, 1);
    assert.equal(harness.fake.closeListeners.length, 1);
    assert.equal(harness.fake.providerRegistrations.length, 1);
    assert.equal(
      harness.fake.providerRegistrations[0]?.viewType,
      'quickJsonViewer.viewer'
    );
    assert.deepEqual(harness.fake.providerRegistrations[0]?.options, {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        enableFindWidget: true,
        retainContextWhenHidden: true
      }
    });
    harness.extension.deactivate();
  } finally {
    harness.restore();
  }
});
