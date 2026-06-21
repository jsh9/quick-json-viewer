import * as vscode from 'vscode';
import { normalizeViewerSettings, ViewerSettings } from './json';
import { SETTINGS_SECTION } from './constants';

export function getSettings(): ViewerSettings {
  const configuration = vscode.workspace.getConfiguration(SETTINGS_SECTION);
  return normalizeViewerSettings({
    largeFileThresholdMb: configuration.get('largeFileThresholdMb'),
    previewLines: configuration.get('previewLines')
  });
}

export interface WebviewMessage {
  readonly type?: unknown;
  readonly value?: unknown;
}

export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
