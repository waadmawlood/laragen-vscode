import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StubConfig, DEFAULT_CONFIG } from './models/stubConfiguration';
import { generateStubs, exportStubs } from './commands/generateStubs';
import { batchGenerate } from './commands/batchGenerate';
import { generateApiDocs } from './commands/generateApiDocs';
import { generateFromSchema } from './commands/generateFromSchema';
import { GenerationHistory } from './models/generationHistory';
import { PreviewProvider } from './webview/previewProvider';
import { detectLaravelVersion } from './utils/laravelDetector';
import { exportPreset, importPreset } from './commands/presets';
import { tryAutoCommit } from './commands/gitOperations';

export class StubGeneratorProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'laravelStubGenerator.sidebar';

  private _view?: vscode.WebviewView;
  private config: StubConfig;
  private previewProvider: PreviewProvider;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _context: vscode.ExtensionContext
  ) {
    const saved = _context.workspaceState.get<StubConfig>('laravelStubConfig');
    this.config = { ...DEFAULT_CONFIG, ...(saved ?? {}) };
    this.previewProvider = new PreviewProvider(_extensionUri);
  }

  private saveConfig(): void {
    this._context.workspaceState.update('laravelStubConfig', this.config);
  }

  private getWorkspaceRoot(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  }

  private getRouteFiles(): string[] {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) return ['api.php'];
    const routesDir = path.join(workspaceRoot, 'routes');
    if (!fs.existsSync(routesDir)) return ['api.php'];
    try {
      return fs.readdirSync(routesDir)
        .filter(f => f.endsWith('.php'))
        .sort();
    } catch {
      return ['api.php'];
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const workspaceRoot = this.getWorkspaceRoot();

      switch (message.command) {
        case 'updateConfig':
          this.config = { ...this.config, ...message.config };
          this.saveConfig();
          break;

        case 'generate': {
          const { entity, version } = message;
          if (!entity) { vscode.window.showErrorMessage('Please enter an entity name.'); return; }
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }

          const result = await generateStubs({ entity, version: version || this.config.defaultVersion, config: this.config, workspaceRoot });

          if (result.errors.length > 0 && result.files.length === 0) {
            vscode.window.showErrorMessage(`Generation failed: ${result.errors.join(', ')}`);
          } else if (result.errors.length > 0) {
            vscode.window.showWarningMessage(`Generated with ${result.errors.length} error(s).`);
          } else {
            vscode.window.showInformationMessage(`✓ Generated ${result.files.length} files for "${entity}"`);
          }

          if (this.config.autoCommit && result.files.length > 0) {
            await tryAutoCommit(workspaceRoot, entity, result.files);
          }

          this._view?.webview.postMessage({
            command: 'generationComplete',
            files: result.files.map(f => ({ relative: path.relative(workspaceRoot, f), full: f })),
            skipped: result.skipped.map(f => ({ relative: path.relative(workspaceRoot, f), full: f })),
            errors: result.errors,
            stubSources: result.stubSources,
          });
          break;
        }

        case 'preview': {
          const { entity, version } = message;
          if (!entity) { vscode.window.showErrorMessage('Please enter an entity name.'); return; }
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }

          const result = await generateStubs({ entity, version: version || this.config.defaultVersion, config: this.config, workspaceRoot, preview: true });

          if (Object.keys(result.previews).length === 0) {
            vscode.window.showWarningMessage('No stubs to preview. Check that at least one component is enabled.');
            return;
          }
          this.previewProvider.show(entity, result.previews);
          break;
        }

        case 'batchGenerate':
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }
          await batchGenerate(this.config, workspaceRoot);
          break;

        case 'generateFromSchema':
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }
          await generateFromSchema(workspaceRoot, this.config.defaultVersion);
          break;

        case 'generateApiDocs':
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }
          await generateApiDocs(workspaceRoot, this.config.defaultVersion);
          break;

        case 'rollback': {
          if (!workspaceRoot) return;
          const history = new GenerationHistory(workspaceRoot);
          const last = history.getLast();
          if (!last) { vscode.window.showInformationMessage('No generation history found.'); return; }
          const confirm = await vscode.window.showWarningMessage(
            `Rollback "${last.entity}" (${last.files.length} files)?`, { modal: true }, 'Rollback'
          );
          if (confirm === 'Rollback') {
            const deleted = await history.rollback(last);
            vscode.window.showInformationMessage(`Rolled back ${deleted.length} files.`);
          }
          break;
        }

        case 'exportStubs': {
          if (!workspaceRoot) { vscode.window.showErrorMessage('No workspace folder open.'); return; }
          const folderName = message.folder || 'stubs';
          const stubsDir = path.join(workspaceRoot, folderName);
          const folderExists = fs.existsSync(stubsDir);
          
          if (folderExists) {
            const confirm = await vscode.window.showWarningMessage(
              `Folder "./${folderName}/" already exists. Overwrite existing stubs?`, { modal: true }, 'Overwrite'
            );
            if (confirm !== 'Overwrite') {
              break;
            }
          }
          
          await exportStubs(workspaceRoot, folderName);
          vscode.window.showInformationMessage(`Exported stubs to ./${folderName}/`);
          break;
        }

        case 'exportPreset':
          await exportPreset(this.config);
          break;

        case 'importPreset': {
          const preset = await importPreset();
          if (preset) {
            this.config = {
              ...this.config,
              features: preset.features,
              route: preset.route ?? this.config.route,
              defaultVersion: preset.defaultVersion,
              useVersion: preset.useVersion ?? this.config.useVersion,
            };
            this.saveConfig();
            webviewView.webview.html = this._getHtmlContent(webviewView.webview);
          }
          break;
        }

        case 'resetConfig': {
          const confirm = await vscode.window.showWarningMessage(
            'Reset all settings to defaults?', { modal: true }, 'Reset'
          );
          if (confirm === 'Reset') {
            this._context.workspaceState.update('laravelStubConfig', undefined);
            this.config = { ...DEFAULT_CONFIG };
            webviewView.webview.html = this._getHtmlContent(webviewView.webview);
            vscode.window.showInformationMessage('Configuration reset to defaults');
          }
          break;
        }

        case 'detectLaravel': {
          if (!workspaceRoot) return;
          const info = detectLaravelVersion(workspaceRoot);
          this._view?.webview.postMessage({ command: 'laravelDetected', info });
          break;
        }

        case 'getRouteFiles': {
          const files = this.getRouteFiles();
          this._view?.webview.postMessage({ command: 'routeFilesList', files });
          break;
        }

        case 'openFile': {
          const { filePath } = message;
          if (!filePath) break;
try {
      const html = this._getHtmlContent(webviewView.webview);
      console.log('[laragen] HTML length:', html.length);
      webviewView.webview.html = html;
      console.log('[laragen] Webview HTML set');
    } catch (err) {
      console.error('[laragen] Failed to set HTML:', err);
      webviewView.webview.html = '<html><body><h1>Error loading</h1><pre>' + String(err) + '</pre></body></html>';
    }
          break;
        }
      }
    });

    const workspaceRoot = this.getWorkspaceRoot();
    if (workspaceRoot) {
      const info = detectLaravelVersion(workspaceRoot);
      setTimeout(() => {
        this._view?.webview.postMessage({ command: 'laravelDetected', info });
        this._view?.webview.postMessage({ command: 'routeFilesList', files: this.getRouteFiles() });
      }, 500);
    }
  }

  private _getHtmlContent(_webview: vscode.Webview): string {
    const config = this.config;
    const features = config.features;
    const routeFiles = this.getRouteFiles();
    const routeOptions = routeFiles.map(f => `<option value="${f}" ${config.route?.file === f ? 'selected' : ''}>${f}</option>`).join('');

    const featureRows = Object.entries(features).map(([key, fc]) => {
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `
        <div class="feature-row">
          <label class="toggle-label">
            <input type="checkbox" class="feature-toggle" data-feature="${key}" ${fc.enabled ? 'checked' : ''}>
            <span class="toggle-slider"></span>
            <span class="feature-name">${label}</span>
          </label>
          <div class="custom-stub-toggle">
            <span class="custom-stub-label">Custom Stub</span>
            <div class="pill-toggle" data-feature="${key}">
              <button class="ucs-true ${fc.useCustomStub ? 'active' : ''}" onclick="setUseCustomStub('${key}', true)">true</button>
              <button class="ucs-false ${!fc.useCustomStub ? 'active' : ''}" onclick="setUseCustomStub('${key}', false)">false</button>
            </div>
          </div>
          <input type="text" class="custom-path-input" data-feature="${key}" value="${fc.customStubPath || ''}"
            placeholder="Path to custom .stub file" ${!fc.useCustomStub ? 'disabled' : ''}>
          <div class="feature-custom-path">
            <div>
              <span class="custom-base-path-label">Custom Base Path</span>
              <input type="text" class="custom-base-path" data-feature="${key}" value="${fc.customBasePath || ''}"
                placeholder="Custom base path (e.g., app/Http/Controllers/Api)">
            </div> 
            <div style="${key === 'migration' ? 'display:none;' : ''}">
              <span class="custom-base-ns-label">Custom Base Namespace</span>
              <input type="text" class="custom-base-ns" data-feature="${key}" value="${fc.customBaseNamespace || ''}"
                placeholder="Custom namespace (e.g., App\\Http\\Controllers\\Api)">
            </div> 
          </div>
        </div>`;
    }).join('');

    const mergeOptions = ['backup', 'skip', 'replace', 'append']
      .map(s => `<option value="${s}" ${config.mergeStrategy === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`)
      .join('');

    const useVersionChecked = config.useVersion !== false ? 'checked' : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Laravel Stub Generator</title>
<style>
  :root {
    --radius: 4px;
    --input-bg: var(--vscode-input-background);
    --input-fg: var(--vscode-input-foreground);
    --input-border: var(--vscode-input-border, #555);
    --btn-bg: var(--vscode-button-background);
    --btn-fg: var(--vscode-button-foreground);
    --btn-hover: var(--vscode-button-hoverBackground);
    --panel-bg: var(--vscode-editorGroupHeader-tabsBackground);
    --border: var(--vscode-panel-border, #3c3c3c);
    --fg: var(--vscode-foreground);
    --success: #4ec9b0;
    --warning: #ce9178;
    --error: #f44747;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--fg); padding: 8px; }

  .section { margin-bottom: 10px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .section-header { background: var(--panel-bg); padding: 6px 10px; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; cursor: pointer; user-select: none; display: flex; justify-content: space-between; align-items: center; }
  .section-header:hover { opacity: 0.85; }
  .section-body { padding: 10px; }
  .section-body.collapsed { display: none; }

  .laravel-badge { font-size: 10px; padding: 2px 6px; border-radius: 10px; background: var(--btn-bg); color: var(--btn-fg); font-weight: normal; }

  label { display: block; font-size: 11px; margin-bottom: 3px; opacity: 0.8; }
  input[type="text"], select { width: 100%; background: var(--input-bg); color: var(--input-fg); border: 1px solid var(--input-border); border-radius: var(--radius); padding: 5px 8px; font-size: 12px; font-family: inherit; outline: none; }
  input[type="text"]:focus, select:focus { border-color: var(--btn-bg); }
  input[type="text"]:disabled { opacity: 0.45; cursor: not-allowed; }

  .row { display: flex; gap: 8px; margin-bottom: 8px; align-items: flex-end; }
  .row > * { flex: 1; }
  .field { margin-bottom: 8px; }

  .btn { display: block; width: 100%; padding: 7px 12px; background: var(--btn-bg); color: var(--btn-fg); border: none; border-radius: var(--radius); cursor: pointer; font-size: 12px; font-family: inherit; font-weight: 600; text-align: center; margin-bottom: 6px; }
  .btn:hover { background: var(--btn-hover); }
  .btn-secondary { background: transparent; border: 1px solid var(--border); color: var(--fg); }
  .btn-secondary:hover { background: var(--panel-bg); }
  .btn-danger { background: #6b2020; }
  .btn-danger:hover { background: #8b2020; }
  .btn-sm { padding: 4px 8px; font-size: 11px; width: auto; display: inline-block; margin-bottom: 0; }
  .btn-row { display: flex; gap: 6px; margin-bottom: 6px; }
  .btn-row .btn { margin-bottom: 0; }

  .version-row { display: flex; gap: 8px; align-items: flex-end; margin-bottom: 8px; }
  .version-row .version-field { flex: 1; }
  .version-row .version-toggle-wrap { display: flex; flex-direction: column; align-items: center; gap: 3px; padding-bottom: 2px; }
  .version-toggle-label { font-size: 10px; opacity: 0.7; white-space: nowrap; }

  .feature-row { display: flex; flex-direction: column; gap: 4px; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .feature-row:last-child { border-bottom: none; }
  .toggle-label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .toggle-label input[type="checkbox"] { display: none; }
  .toggle-slider { width: 28px; height: 15px; background: #555; border-radius: 8px; position: relative; flex-shrink: 0; transition: background 0.2s; }
  .toggle-slider::after { content: ''; width: 11px; height: 11px; background: #fff; border-radius: 50%; position: absolute; top: 2px; left: 2px; transition: left 0.2s; }
  input[type="checkbox"]:checked + .toggle-slider { background: var(--btn-bg); }
  input[type="checkbox"]:checked + .toggle-slider::after { left: 15px; }
  .feature-name { font-size: 12px; }

  .custom-stub-toggle { display: flex; align-items: center; gap: 6px; }
  .custom-stub-label { font-size: 10px; opacity: 0.7; }
  .custom-path-input { font-size: 10px; font-family: monospace; padding: 3px 6px; }
  .custom-path-input:disabled { display: none; }
  .feature-custom-path { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
  .feature-custom-path input { font-size: 10px; font-family: monospace; padding: 3px 6px; flex: 1; }

  .pill-toggle { display: flex; border: 1px solid var(--border); border-radius: 3px; overflow: hidden; }
  .pill-toggle button { flex: 1; padding: 4px 8px; border: none; background: transparent; color: var(--fg); cursor: pointer; font-size: 11px; font-family: inherit; opacity: 0.5; }
  .pill-toggle button.active { background: var(--btn-bg); color: var(--btn-fg); opacity: 1; }

  .route-row { display: flex; gap: 8px; align-items: flex-end; padding: 8px 0; border-top: 1px solid var(--border); margin-top: 8px; }
  .route-row .route-toggle { display: flex; align-items: center; gap: 8px; }
  .route-row .route-file-select { flex: 1; }

  .output-log { background: var(--input-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px; min-height: 60px; max-height: 140px; overflow-y: auto; font-family: monospace; font-size: 11px; }
  .log-line { margin-bottom: 2px; }
  .log-success { color: var(--success); }
  .log-error { color: var(--error); }
  .log-skip { color: var(--warning); }
  .log-info { opacity: 0.7; }
  .log-source { font-size: 10px; opacity: 0.45; }
  .log-file { color: var(--success); cursor: pointer; text-decoration: underline; }
  .log-file:hover { opacity: 0.7; }

  .merge-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .merge-row label { margin: 0; white-space: nowrap; }
  .check-option { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; font-size: 11px; cursor: pointer; }
  .check-option input { cursor: pointer; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 8px 0; }
  .hint { font-size: 10px; opacity: 0.5; margin-top: 3px; line-height: 1.4; }
  .custom-base-path-label,.custom-base-ns-label {display: inline-block; padding: 2px 4px; color: #fff; border-radius: 4px; font-size: 8px;}
  .custom-base-path-label {background: #0d6efd;}
  .custom-base-ns-label {background: #6c757d;}
</style>
</head>
<body>

<div class="section">
  <div class="section-header" onclick="toggleSection('generate')">
    <span>⚡ Generate</span>
    <span id="laravel-badge" class="laravel-badge" style="display:none"></span>
  </div>
  <div class="section-body" id="sec-generate">

    <div class="field">
      <label>Entity Name</label>
      <input type="text" id="entityInput" placeholder="Post, User, Comment..." />
    </div>

    <div class="version-row">
      <div class="version-field">
        <label>Version</label>
        <input type="text" id="versionInput" value="${config.defaultVersion}" placeholder="v1" ${config.useVersion === false ? 'disabled' : ''} />
      </div>
      <div class="version-toggle-wrap">
        <span class="version-toggle-label">Use Version</span>
        <div class="pill-toggle" id="useVersionToggle">
          <button id="uvTrue"  class="${config.useVersion !== false ? 'active' : ''}" onclick="setUseVersion(true)">true</button>
          <button id="uvFalse" class="${config.useVersion === false ? 'active' : ''}" onclick="setUseVersion(false)">false</button>
        </div>
      </div>
    </div>
    <div class="hint" id="versionHint" style="${config.useVersion === false ? '' : 'display:none'}">
      Version disabled — files go to flat paths (app/Models/Post.php)
    </div>

    <div class="route-row">
      <div class="route-toggle">
        <label class="toggle-label">
          <input type="checkbox" id="routeEnabled" ${config.route?.enabled ? 'checked' : ''} onchange="updateRouteEnabled(this.checked)">
          <span class="toggle-slider"></span>
          <span class="feature-name">Route</span>
        </label>
      </div>
      <div class="route-file-select">
        <label>Route File</label>
        <select id="routeFileSelect" onchange="updateRouteFile(this.value)" ${!config.route?.enabled ? 'disabled' : ''}>
          ${routeOptions}
        </select>
      </div>
    </div>

    <div class="btn-row">
      <button class="btn" onclick="generate()">Generate</button>
      <button class="btn btn-secondary" onclick="preview()">Preview</button>
    </div>
    <button class="btn btn-secondary" onclick="send('batchGenerate')">Batch Generate...</button>

    <div class="output-log" id="outputLog">
      <div class="log-line log-info">Ready. Enter entity name and click Generate.</div>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-header" onclick="toggleSection('features')">
    <span>🧩 Components</span>
    <span style="font-size:10px;opacity:0.6">▾</span>
  </div>
  <div class="section-body collapsed" id="sec-features">
    <div class="btn-row" style="margin-bottom:8px">
      <button class="btn btn-secondary btn-sm" onclick="selectAll(true)">All</button>
      <button class="btn btn-secondary btn-sm" onclick="selectAll(false)">None</button>
    </div>
    ${featureRows}
    <p class="hint" style="margin-top:8px">
      Enable "Custom Stub" = true to use your own .stub file. False uses extension built-in stubs.
    </p>
  </div>
</div>

<div class="section">
  <div class="section-header" onclick="toggleSection('settings')">
    <span>⚙️ Settings</span>
    <span style="font-size:10px;opacity:0.6">▾</span>
  </div>
  <div class="section-body collapsed" id="sec-settings">
    <div class="merge-row">
      <label>Merge strategy:</label>
      <select id="mergeStrategy" onchange="updateSetting('mergeStrategy', this.value)">
        ${mergeOptions}
      </select>
    </div>
    <label class="check-option">
      <input type="checkbox" id="autoCommit" ${config.autoCommit ? 'checked' : ''} onchange="updateSetting('autoCommit', this.checked)">
      Auto Git commit after generation
    </label>
    <label class="check-option">
      <input type="checkbox" id="autoOpenFiles" ${config.autoOpenFiles ? 'checked' : ''} onchange="updateSetting('autoOpenFiles', this.checked)">
      Auto-open generated files
    </label>
    <button class="btn btn-danger btn-sm" onclick="send('resetConfig')" style="margin-top:8px">Reset to Defaults</button>
  </div>
</div>

<div class="section">
  <div class="section-header" onclick="toggleSection('tools')">
    <span>🔧 Tools</span>
    <span style="font-size:10px;opacity:0.6">▾</span>
  </div>
  <div class="section-body collapsed" id="sec-tools">
    <button class="btn btn-secondary" onclick="send('generateFromSchema')">Schema → Model</button>
    <button class="btn btn-secondary" onclick="send('generateApiDocs')">Generate OpenAPI Docs</button>
    <hr class="divider">
    <div class="mb-2">
      <input type="text" id="exportStubsFolder" class="form-control mb-2" value="stubs" placeholder="Folder name">
      <button class="btn btn-secondary" type="button" onclick="doExportStubs()">Export Stubs</button>
    </div>
    <hr class="divider">
    <div class="btn-row">
      <button class="btn btn-secondary" onclick="send('exportPreset')">Export Preset</button>
      <button class="btn btn-secondary" onclick="send('importPreset')">Import Preset</button>
    </div>
    <hr class="divider">
    <button class="btn btn-danger" onclick="send('rollback')">↩ Rollback Last</button>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  function send(command, extra) {
    vscode.postMessage({ command, ...(extra || {}) });
  }

  function setUseVersion(val) {
    document.getElementById('uvTrue').classList.toggle('active', val === true);
    document.getElementById('uvFalse').classList.toggle('active', val === false);
    document.getElementById('versionInput').disabled = (val === false);
    document.getElementById('versionHint').style.display = (val === false) ? '' : 'none';
    const cfg = collectConfig();
    cfg.useVersion = val;
    send('updateConfig', { config: cfg });
  }

  function setUseCustomStub(feature, val) {
    const parent = document.querySelector('.pill-toggle[data-feature="' + feature + '"]');
    parent.querySelector('.ucs-true').classList.toggle('active', val === true);
    parent.querySelector('.ucs-false').classList.toggle('active', val === false);
    const pathInput = document.querySelector('.custom-path-input[data-feature="' + feature + '"]');
    if (pathInput) pathInput.disabled = !val;
    const cfg = collectConfig();
    send('updateConfig', { config: cfg });
  }

  function updateRouteEnabled(val) {
    document.getElementById('routeFileSelect').disabled = !val;
    const cfg = collectConfig();
    send('updateConfig', { config: cfg });
  }

  function updateRouteFile(val) {
    const cfg = collectConfig();
    send('updateConfig', { config: cfg });
  }

  function doExportStubs() {
    const folderName = document.getElementById('exportStubsFolder').value.trim() || 'stubs';
    send('exportStubs', { folder: folderName });
  }

  function generate() {
    const entity  = document.getElementById('entityInput').value.trim();
    const version = document.getElementById('versionInput').value.trim();
    if (!entity) { log('Enter entity name first', 'error'); return; }
    clearLog();
    const uv = document.getElementById('uvTrue').classList.contains('active');
    log('Generating ' + entity + (uv ? ' (' + version + ')' : '') + '...', 'info');
    send('generate', { entity, version });
  }

  function preview() {
    const entity  = document.getElementById('entityInput').value.trim();
    const version = document.getElementById('versionInput').value.trim();
    if (!entity) { log('Enter entity name first', 'error'); return; }
    send('preview', { entity, version });
  }

  function selectAll(val) {
    document.querySelectorAll('.feature-toggle').forEach(cb => {
      cb.checked = val;
      cb.dispatchEvent(new Event('change'));
    });
  }

  function updateSetting(key, value) {
    const cfg = collectConfig();
    cfg[key] = value;
    send('updateConfig', { config: cfg });
  }

  function collectConfig() {
    const features = {};
    document.querySelectorAll('.feature-toggle').forEach(cb => {
      const feature = cb.dataset.feature;
      const pillToggle = document.querySelector('.pill-toggle[data-feature="' + feature + '"]');
      const useCustomStub = pillToggle ? pillToggle.querySelector('.ucs-true').classList.contains('active') : false;
      const pathInput = document.querySelector('.custom-path-input[data-feature="' + feature + '"]');
      const basePathInput = document.querySelector('.custom-base-path[data-feature="' + feature + '"]');
      const baseNsInput = document.querySelector('.custom-base-ns[data-feature="' + feature + '"]');
      features[feature] = {
        enabled: cb.checked,
        useCustomStub: useCustomStub,
        customStubPath: pathInput ? pathInput.value.trim() : '',
        customBasePath: basePathInput ? basePathInput.value.trim() : '',
        customBaseNamespace: baseNsInput ? baseNsInput.value.trim() : ''
      };
    });
    return {
      features,
      route: {
        enabled: document.getElementById('routeEnabled').checked,
        file: document.getElementById('routeFileSelect').value
      },
      defaultVersion: document.getElementById('versionInput').value.trim(),
      useVersion: document.getElementById('uvTrue').classList.contains('active'),
      mergeStrategy: document.getElementById('mergeStrategy').value,
      autoCommit: document.getElementById('autoCommit').checked,
      autoOpenFiles: document.getElementById('autoOpenFiles').checked,
    };
  }

  document.querySelectorAll('.feature-toggle').forEach(el => {
    el.addEventListener('change', () => send('updateConfig', { config: collectConfig() }));
  });
  document.querySelectorAll('.custom-path-input').forEach(el => {
    el.addEventListener('blur', () => send('updateConfig', { config: collectConfig() }));
  });
  document.querySelectorAll('.custom-base-path, .custom-base-ns').forEach(el => {
    el.addEventListener('blur', () => send('updateConfig', { config: collectConfig() }));
  });

  document.getElementById('entityInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') generate();
  });

  function toggleSection(id) {
    document.getElementById('sec-' + id).classList.toggle('collapsed');
  }

  function clearLog() { document.getElementById('outputLog').innerHTML = ''; }

  function log(msg, type, filePath = null) {
    const el = document.createElement('div');
    el.className = 'log-line log-' + (type || 'info');
    if (filePath) {
      el.className += ' log-file';
      el.textContent = msg;
      el.title = 'Click to open file';
      el.onclick = () => send('openFile', { filePath });
    } else {
      el.textContent = msg;
    }
    document.getElementById('outputLog').appendChild(el);
    document.getElementById('outputLog').scrollTop = 9999;
  }

  function logFile(msg, filePath, type = 'success') {
    log(msg, type, filePath);
  }

  window.addEventListener('message', e => {
    const msg = e.data;

    if (msg.command === 'generationComplete') {
      clearLog();
      if (msg.files.length > 0) {
        log('✓ ' + msg.files.length + ' file(s) generated:', 'success');
        msg.files.forEach(f => logFile(f.relative, f.full, 'success'));
      }
      if (msg.skipped.length > 0) {
        log('⊘ ' + msg.skipped.length + ' skipped (already exist):', 'skip');
        msg.skipped.forEach(f => logFile(f.relative, f.full, 'skip'));
      }
      if (msg.errors.length > 0) {
        msg.errors.forEach(err => log('✗ ' + err, 'error'));
      }
      if (msg.stubSources) {
        const sources = Object.values(msg.stubSources);
        const extension = sources.filter(s => s === 'extension').length;
        const custom  = sources.filter(s => String(s).startsWith('custom:')).length;
        const parts = [];
        if (custom)    parts.push(custom + ' custom');
        if (extension) parts.push(extension + ' extension');
        if (parts.length) log('  [stubs: ' + parts.join(', ') + ']', 'info');
      }
    }

    if (msg.command === 'laravelDetected') {
      const badge = document.getElementById('laravel-badge');
      if (msg.info.detected) {
        badge.textContent = 'Laravel ' + msg.info.majorVersion;
        badge.style.display = 'inline';
      }
    }

    if (msg.command === 'routeFilesList') {
      const select = document.getElementById('routeFileSelect');
      if (select && msg.files) {
        const currentVal = select.value;
        select.innerHTML = msg.files.map(f => '<option value="' + f + '"' + (f === currentVal ? ' selected' : '') + '>' + f + '</option>').join('');
      }
    }
  });

  send('detectLaravel');
  send('getRouteFiles');
</script>
</body>
</html>`;
  }
}
