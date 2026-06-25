import * as assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { test } from 'node:test';

test('package main points to the compiled extension entrypoint', async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
  ) as { readonly main?: unknown };

  const main = packageJson.main;
  assert.equal(typeof main, 'string');

  if (typeof main !== 'string') {
    throw new TypeError('package.json main must be a string');
  }

  await fs.access(path.join(process.cwd(), main));
});

test('package contributes JSON viewer without forcing JSON diff associations', async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
  ) as {
    readonly activationEvents?: unknown;
    readonly contributes?: {
      readonly configurationDefaults?: {
        readonly 'workbench.editorAssociations'?: Record<string, string>;
      };
      readonly languages?: Array<{
        readonly id?: unknown;
        readonly extensions?: unknown;
      }>;
      readonly commands?: Array<{
        readonly command?: unknown;
        readonly title?: unknown;
      }>;
      readonly menus?: {
        readonly 'editor/title'?: Array<{
          readonly command?: unknown;
          readonly when?: unknown;
        }>;
      };
      readonly customEditors?: Array<{
        readonly viewType?: unknown;
        readonly priority?: unknown;
        readonly selector?: Array<{ readonly filenamePattern?: unknown }>;
      }>;
      readonly configuration?: {
        readonly properties?: Record<
          string,
          {
            readonly default?: unknown;
            readonly maximum?: unknown;
            readonly minimum?: unknown;
          }
        >;
      };
    };
  };

  assert.equal(
    packageJson.contributes?.configurationDefaults?.[
      'workbench.editorAssociations'
    ]?.['*.json'],
    undefined
  );

  const openCommand = packageJson.contributes?.commands?.find(
    (command) => command.command === 'quickJsonViewer.openCurrentFile'
  );
  assert.equal(openCommand?.title, 'Open in Quick JSON Viewer');

  const customEditor = packageJson.contributes?.customEditors?.find(
    (editor) => editor.viewType === 'quickJsonViewer.viewer'
  );

  assert.equal(customEditor?.priority, 'option');
  assert.ok(
    customEditor?.selector?.some(
      (selector) => selector.filenamePattern === '*.json'
    )
  );
  const editorTitleCommand = packageJson.contributes?.menus?.[
    'editor/title'
  ]?.find((menuItem) => menuItem.command === 'quickJsonViewer.openCurrentFile');
  assert.equal(
    editorTitleCommand?.when,
    'resourceExtname == .json && !isInDiffEditor'
  );
  assert.ok(Array.isArray(packageJson.activationEvents));
  assert.ok(
    packageJson.activationEvents.includes(
      'onCommand:quickJsonViewer.openSampleFiles'
    )
  );
  assert.ok(packageJson.activationEvents.includes('onLanguage:json'));
  assert.ok(
    packageJson.contributes?.languages?.some(
      (language) =>
        language.id === 'json' &&
        Array.isArray(language.extensions) &&
        language.extensions.includes('.json')
    )
  );
  assert.equal(
    packageJson.contributes?.configuration?.properties?.[
      'quickJsonViewer.largeFileThresholdMb'
    ]?.default,
    10
  );
  assert.equal(
    packageJson.contributes?.configuration?.properties?.[
      'quickJsonViewer.previewLines'
    ]?.default,
    100
  );
  assert.equal(
    packageJson.contributes?.configuration?.properties?.[
      'quickJsonViewer.previewLines'
    ]?.maximum,
    undefined
  );
  assert.equal(
    packageJson.contributes?.configuration?.properties?.[
      'quickJsonViewer.maxAllowablePreviewLines'
    ]?.default,
    10000
  );
  assert.equal(
    packageJson.contributes?.configuration?.properties?.[
      'quickJsonViewer.maxAllowablePreviewLines'
    ]?.minimum,
    -1
  );
});

test('package wires local test hooks, formatting, and GitHub Actions test workflow', async () => {
  const packageJson = JSON.parse(
    await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8')
  ) as {
    readonly scripts?: Record<string, unknown>;
    readonly devDependencies?: Record<string, unknown>;
  };

  assert.equal(
    packageJson.scripts?.['test'],
    'npm run format:check && npm run compile && npm run test:coverage'
  );
  assert.equal(
    packageJson.scripts?.['test:unit'],
    'node scripts/run-tests.cjs'
  );
  assert.equal(
    packageJson.scripts?.['test:vscode'],
    'npm run compile && vscode-test'
  );
  assert.equal(
    packageJson.scripts?.['format'],
    'prettier . --write --ignore-unknown'
  );
  assert.equal(packageJson.scripts?.['prepare'], 'husky');
  assert.equal(
    typeof packageJson.devDependencies?.['@vscode/test-cli'],
    'string'
  );
  assert.equal(typeof packageJson.devDependencies?.['c8'], 'string');
  assert.equal(typeof packageJson.devDependencies?.['esbuild'], 'string');
  assert.equal(typeof packageJson.devDependencies?.['husky'], 'string');
  assert.equal(typeof packageJson.devDependencies?.['prettier'], 'string');

  const preCommitHook = await fs.readFile(
    path.join(process.cwd(), '.husky', 'pre-commit'),
    'utf8'
  );
  assert.match(preCommitHook, /npm test/);

  const workflow = await fs.readFile(
    path.join(process.cwd(), '.github', 'workflows', 'test.yml'),
    'utf8'
  );
  assert.match(workflow, /HUSKY: 0/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /xvfb-run -a npm run test:vscode/);
});
