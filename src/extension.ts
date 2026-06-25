import * as vscode from 'vscode';
import {
  COMMAND_OPEN_CURRENT_FILE,
  COMMAND_OPEN_SAMPLE_FILES,
  VIEW_TYPE
} from './constants';
import {
  allowJsonAutoOpen,
  autoOpenJsonViewerForTextEditor,
  openJsonViewer,
  openSampleJsonFiles
} from './commands';
import { JsonViewerProvider } from './viewerProvider';
import { formatError } from './viewerProtocol';

const AUTO_OPEN_RECHECK_DELAYS_MS = [0, 100, 500] as const;

export function activate(context: vscode.ExtensionContext): void {
  const autoOpenJsonViewer = (editor: vscode.TextEditor | undefined): void => {
    void autoOpenJsonViewerForTextEditor(editor).catch((error: unknown) => {
      void vscode.window.showErrorMessage(
        `Quick JSON Viewer failed to auto-open the file: ${formatError(error)}`
      );
    });
  };

  const scheduleAutoOpenJsonViewer = (expectedUri?: vscode.Uri): void => {
    for (const delayMs of AUTO_OPEN_RECHECK_DELAYS_MS) {
      setTimeout(() => {
        const editor = vscode.window.activeTextEditor;
        if (
          expectedUri &&
          editor?.document.uri.toString() !== expectedUri.toString()
        ) {
          return;
        }

        autoOpenJsonViewer(editor);
      }, delayMs);
    }
  };

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
    vscode.window.onDidChangeActiveTextEditor(autoOpenJsonViewer),
    vscode.workspace.onDidOpenTextDocument((document) => {
      scheduleAutoOpenJsonViewer(document.uri);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      allowJsonAutoOpen(document.uri);
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

  autoOpenJsonViewer(vscode.window.activeTextEditor);
  scheduleAutoOpenJsonViewer();
}

export function deactivate(): void {
  // VS Code owns provider and command disposables registered during activation.
}
