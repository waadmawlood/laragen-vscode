import * as vscode from 'vscode';

export class PreviewProvider {
  private panel: vscode.WebviewPanel | undefined;

  constructor(private readonly extensionUri: vscode.Uri) {}

  show(entity: string, previews: Record<string, string>): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Beside);
    } else {
      this.panel = vscode.window.createWebviewPanel(
        'laravelStubPreview',
        `Preview: ${entity}`,
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        }
      );

      this.panel.onDidDispose(() => {
        this.panel = undefined;
      });
    }

    this.panel.title = `Preview: ${entity}`;
    this.panel.webview.html = this.buildHtml(entity, previews);

    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'copy') {
        vscode.env.clipboard.writeText(msg.text);
        vscode.window.showInformationMessage('Copied to clipboard');
      }
    });
  }

  private buildHtml(entity: string, previews: Record<string, string>): string {
    const tabs = Object.keys(previews);

    const tabButtons = tabs
      .map((t, i) => `<button class="tab-btn ${i === 0 ? 'active' : ''}" onclick="showTab('${t}')" id="btn-${t}">${t.replace('_', ' ')}</button>`)
      .join('');

    const tabPanels = tabs
      .map((t, i) => {
        const escaped = previews[t]
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `
          <div class="tab-panel ${i === 0 ? 'active' : ''}" id="panel-${t}">
            <div class="toolbar">
              <span class="filename">${t}.php</span>
              <button onclick="copyTab('${t}')">Copy</button>
            </div>
            <pre><code class="php">${escaped}</code></pre>
          </div>`;
      })
      .join('');

    const previewsJson = JSON.stringify(previews);

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview: ${entity}</title>
<style>
  :root { --bg: var(--vscode-editor-background); --fg: var(--vscode-editor-foreground); --border: var(--vscode-panel-border); --tab-active: var(--vscode-tab-activeBackground); --tab-hover: var(--vscode-tab-hoverBackground); --btn-bg: var(--vscode-button-background); --btn-fg: var(--vscode-button-foreground); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--fg); font-family: var(--vscode-font-family); font-size: 13px; height: 100vh; display: flex; flex-direction: column; }
  .header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; font-weight: 600; }
  .tabs { display: flex; gap: 2px; padding: 8px 16px 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .tab-btn { background: transparent; border: none; color: var(--fg); padding: 6px 14px; cursor: pointer; border-radius: 4px 4px 0 0; opacity: 0.7; font-size: 12px; }
  .tab-btn:hover { background: var(--tab-hover); opacity: 1; }
  .tab-btn.active { background: var(--tab-active); opacity: 1; border-bottom: 2px solid var(--btn-bg); }
  .tab-panel { display: none; flex: 1; overflow: auto; flex-direction: column; }
  .tab-panel.active { display: flex; }
  .toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 16px; border-bottom: 1px solid var(--border); background: var(--vscode-editorGroupHeader-tabsBackground); }
  .filename { font-family: monospace; font-size: 12px; opacity: 0.8; }
  .toolbar button { background: var(--btn-bg); color: var(--btn-fg); border: none; padding: 4px 12px; border-radius: 3px; cursor: pointer; font-size: 12px; }
  .toolbar button:hover { opacity: 0.85; }
  pre { flex: 1; overflow: auto; padding: 16px; margin: 0; font-family: var(--vscode-editor-font-family, monospace); font-size: var(--vscode-editor-font-size, 13px); line-height: 1.5; white-space: pre; }
  code { display: block; }
</style>
</head>
<body>
<div class="header">Preview — ${entity}</div>
<div class="tabs">${tabButtons}</div>
${tabPanels}
<script>
  const vscode = acquireVsCodeApi();
  const previews = ${previewsJson};

  function showTab(id) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('panel-' + id)?.classList.add('active');
    document.getElementById('btn-' + id)?.classList.add('active');
  }

  function copyTab(id) {
    vscode.postMessage({ command: 'copy', text: previews[id] ?? '' });
  }
</script>
</body>
</html>`;
  }
}
