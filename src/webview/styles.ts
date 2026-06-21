export function getWebviewStyles(): string {
  return /* css */ `    :root {
      color-scheme: light dark;
      --quick-json-key: #0451a5;
      --quick-json-string: #a31515;
      --quick-json-number: #098658;
      --quick-json-literal: #0000ff;
      --quick-json-punctuation: #383a42;
    }

    body.vscode-dark {
      --quick-json-key: #9cdcfe;
      --quick-json-string: #ce9178;
      --quick-json-number: #b5cea8;
      --quick-json-literal: #569cd6;
      --quick-json-punctuation: #d4d4d4;
    }

    body.vscode-high-contrast,
    body.vscode-high-contrast-light {
      --quick-json-key: #ffff00;
      --quick-json-string: #7ee787;
      --quick-json-number: #79c0ff;
      --quick-json-literal: #ffa657;
      --quick-json-punctuation: var(--vscode-editor-foreground);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 42px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    }

    .info {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-width: 0;
      color: var(--vscode-descriptionForeground);
    }

    .info-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }

    .info-item:not(:first-child)::before {
      content: "|";
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
      user-select: none;
    }

    #preview-status:empty {
      display: none;
    }

    .info strong {
      color: var(--vscode-editor-foreground);
      font-weight: 600;
    }

    .setting-control {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
    }

    .setting-input {
      appearance: textfield;
      -moz-appearance: textfield;
      width: 72px;
      min-width: 0;
      border: 1px solid var(--vscode-input-border, var(--vscode-editorWidget-border));
      border-radius: 3px;
      padding: 2px 6px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      font: inherit;
    }

    .setting-input::-webkit-inner-spin-button,
    .setting-input::-webkit-outer-spin-button {
      margin: 0;
      -webkit-appearance: none;
    }

    .setting-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 1px;
    }

    .setting-input.invalid {
      border-color: var(--vscode-inputValidation-errorBorder);
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-input-background));
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-input-foreground));
    }

    .setting-input:disabled {
      opacity: 0.55;
    }

    .input-error {
      color: var(--vscode-inputValidation-errorForeground, var(--vscode-errorForeground));
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      flex-wrap: wrap;
    }

    button {
      min-width: 104px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 3px;
      padding: 4px 10px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      font: inherit;
      cursor: pointer;
    }

    button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }

    button:disabled {
      opacity: 0.55;
      cursor: default;
    }

    button:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    .view-tabs {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 2px;
      padding: 2px;
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 4px;
      background: var(--vscode-editor-background);
    }

    .view-button {
      min-width: auto;
      border: 0;
      padding: 4px 9px;
      color: var(--vscode-foreground);
      background: transparent;
    }

    .view-button:hover:not(:disabled) {
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-button-secondaryHoverBackground));
    }

    .view-button[aria-pressed="true"] {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }

    main {
      padding: 12px;
    }

    .status,
    .error-panel {
      margin: 0 0 12px;
      color: var(--vscode-descriptionForeground);
    }

    .error-panel {
      padding: 10px 12px;
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-inputValidation-errorForeground);
    }

    .preview-frame {
      border: 1px solid var(--vscode-editorWidget-border, var(--vscode-panel-border));
      border-radius: 4px;
      overflow: auto;
      background: var(--vscode-editor-background);
    }

    .preview-text {
      padding: 10px 12px;
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.45;
    }

    .json-token-key {
      color: var(--quick-json-key);
      font-weight: 600;
    }

    .json-token-string {
      color: var(--quick-json-string);
    }

    .json-token-number {
      color: var(--quick-json-number);
    }

    .json-token-literal {
      color: var(--quick-json-literal);
    }

    .json-token-punctuation {
      color: var(--quick-json-punctuation);
    }
  `;
}
