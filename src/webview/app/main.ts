import { createWebviewApp } from './app';
import { collectDomElements } from './dom';

declare const acquireVsCodeApi:
  | undefined
  | (() => { postMessage(message: unknown): void });

const vscode =
  typeof acquireVsCodeApi === 'function'
    ? acquireVsCodeApi()
    : { postMessage: () => undefined };

createWebviewApp(vscode, collectDomElements());
