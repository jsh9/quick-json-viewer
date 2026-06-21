import * as vscode from 'vscode';
import {
  COMMAND_OPEN_CURRENT_FILE,
  COMMAND_OPEN_SAMPLE_FILES,
  VIEW_TYPE
} from './constants';
import { openJsonViewer, openSampleJsonFiles } from './commands';
import { JsonViewerProvider } from './viewerProvider';
import { formatError } from './viewerProtocol';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      COMMAND_OPEN_CURRENT_FILE,
      (resource?: vscode.Uri) => {
        void openJsonViewer(resource).catch((error: unknown) => {
          void vscode.window.showErrorMessage(
            `Quick JSON Viewer failed to open the file: ${formatError(error)}`
          );
        });
      }
    ),
    vscode.commands.registerCommand(COMMAND_OPEN_SAMPLE_FILES, () => {
      void openSampleJsonFiles(context.extensionUri).catch((error: unknown) => {
        void vscode.window.showErrorMessage(
          `Quick JSON Viewer failed to open sample files: ${formatError(error)}`
        );
      });
    }),
    vscode.window.registerCustomEditorProvider(
      VIEW_TYPE,
      new JsonViewerProvider(),
      {
        supportsMultipleEditorsPerDocument: true,
        webviewOptions: {
          enableFindWidget: true,
          retainContextWhenHidden: true
        }
      }
    )
  );
}

export function deactivate(): void {
  // VS Code owns provider and command disposables registered during activation.
}
