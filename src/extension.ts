import * as vscode from 'vscode';
import { StubGeneratorProvider } from './stubGeneratorProvider';
import { GenerationHistory } from './models/generationHistory';
import { batchGenerate } from './commands/batchGenerate';
import { generateApiDocs } from './commands/generateApiDocs';
import { generateFromSchema } from './commands/generateFromSchema';
import { exportPreset, importPreset } from './commands/presets';
import { DEFAULT_CONFIG } from './models/stubConfiguration';

export function activate(context: vscode.ExtensionContext): void {
  const provider = new StubGeneratorProvider(context.extensionUri, context);

  // Register webview sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      StubGeneratorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('laravel-stub-generator.generate', () => {
      vscode.commands.executeCommand('laravelStubGenerator.sidebar.focus');
    }),

    vscode.commands.registerCommand('laravel-stub-generator.batchGenerate', async () => {
      const config = context.workspaceState.get('laravelStubConfig') ?? DEFAULT_CONFIG;
      await batchGenerate(config as any, workspaceRoot);
    }),

    vscode.commands.registerCommand('laravel-stub-generator.generateFromSchema', async () => {
      const config = context.workspaceState.get('laravelStubConfig') ?? DEFAULT_CONFIG;
      const cfg = config as any;
      await generateFromSchema(workspaceRoot, cfg.defaultVersion ?? 'v1');
    }),

    vscode.commands.registerCommand('laravel-stub-generator.generateApiDocs', async () => {
      const config = context.workspaceState.get('laravelStubConfig') ?? DEFAULT_CONFIG;
      const cfg = config as any;
      await generateApiDocs(workspaceRoot, cfg.defaultVersion ?? 'v1');
    }),

    vscode.commands.registerCommand('laravel-stub-generator.rollback', async () => {
      if (!workspaceRoot) {
        vscode.window.showErrorMessage('No workspace open.');
        return;
      }
      const history = new GenerationHistory(workspaceRoot);
      const last = history.getLast();
      if (!last) {
        vscode.window.showInformationMessage('No generation history found.');
        return;
      }
      const confirm = await vscode.window.showWarningMessage(
        `Rollback "${last.entity}" generation? This will delete ${last.files.length} files.`,
        { modal: true },
        'Rollback'
      );
      if (confirm === 'Rollback') {
        const deleted = await history.rollback(last);
        vscode.window.showInformationMessage(`Rolled back: deleted ${deleted.length} files.`);
      }
    }),

    vscode.commands.registerCommand('laravel-stub-generator.exportPreset', async () => {
      const config = context.workspaceState.get('laravelStubConfig') ?? DEFAULT_CONFIG;
      await exportPreset(config as any);
    }),

vscode.commands.registerCommand('laravel-stub-generator.importPreset', async () => {
      const preset = await importPreset();
      if (preset) {
        const existing = (context.workspaceState.get('laravelStubConfig') ?? DEFAULT_CONFIG) as any;
        context.workspaceState.update('laravelStubConfig', {
          ...existing,
          features: preset.features,
          defaultVersion: preset.defaultVersion,
          useVersion: preset.useVersion ?? existing.useVersion,
        });
        vscode.window.showInformationMessage(`Preset "${preset.name}" applied.`);
      }
    }),

    vscode.commands.registerCommand('laravel-stub-generator.openFile', async (filePath: string) => {
      if (!filePath) return;
      try {
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open file: ${err.message}`);
      }
    })
  );

  // Migration file watcher
  if (workspaceRoot) {
    const watcher = vscode.workspace.createFileSystemWatcher('**/database/migrations/*.php');
    watcher.onDidChange((uri) => {
      vscode.window.showInformationMessage(
        `Migration changed: ${uri.fsPath.split('/').pop()}. Regenerate model?`,
        'Generate from Schema'
      ).then(sel => {
        if (sel) {
          vscode.commands.executeCommand('laravel-stub-generator.generateFromSchema');
        }
      });
    });
    context.subscriptions.push(watcher);
  }
}

export function deactivate(): void {}
