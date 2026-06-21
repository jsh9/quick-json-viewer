import { getWebviewScript } from './script';
import { getWebviewStyles } from './styles';

export function getHtml(fileName: string): string {
  const nonce = getNonce();
  const escapedTitle = escapeHtml(fileName);

  /* c8 ignore start -- Embedded webview browser code is covered through built source and contract tests. */
  const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapedTitle}</title>
  <style nonce="${nonce}">
${getWebviewStyles()}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="info" aria-live="polite">
      <span class="info-item"><strong>Size:</strong> <span id="file-size">Loading...</span></span>
      <span class="info-item"><strong>Total lines:</strong> <span id="line-count">Counting...</span></span>
      <label class="setting-control info-item"><strong>Show</strong> <input id="preview-lines-input" class="setting-input" type="number" min="1" step="1" inputmode="numeric" aria-describedby="preview-lines-error"> <span>lines</span></label>
      <span id="preview-lines-error" class="input-error" role="status"></span>
      <span class="info-item"><strong>Modified:</strong> <span id="modified">Loading...</span></span>
      <span id="preview-status" class="info-item"></span>
    </div>
    <div class="actions">
      <div class="view-tabs" role="toolbar" aria-label="JSON view">
        <button class="view-button" type="button" id="truncated-view" aria-pressed="true">Truncated</button>
        <button class="view-button" type="button" id="show-raw-json" aria-pressed="false">Show raw JSON</button>
      </div>
    </div>
  </header>
  <main id="content" tabindex="-1">
    <p class="status">Loading JSON preview...</p>
  </main>
  <script nonce="${nonce}">
${getWebviewScript()}
  </script>
</body>
</html>`;
  /* c8 ignore stop */
  return html;
}

function getNonce(): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
