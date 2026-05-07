import * as vscode from 'vscode';
import { StubConfig } from '../models/stubConfiguration';
import { generateStubs } from './generateStubs';

export async function batchGenerate(config: StubConfig, workspaceRoot: string): Promise<void> {
  // Step 1: get entity names
  const input = await vscode.window.showInputBox({
    prompt: 'Enter entity names (comma-separated)',
    placeHolder: 'User, Post, Comment',
    validateInput: (v) => v.trim().length === 0 ? 'Enter at least one entity name' : undefined,
  });

  if (!input) return;

  const entities = input
    .split(',')
    .map(e => e.trim())
    .filter(e => e.length > 0);

  // Step 2: get version
  const version = await vscode.window.showInputBox({
    prompt: 'API version for all entities',
    value: config.defaultVersion,
    placeHolder: 'v1',
  });

  if (!version) return;

  const total = entities.length;
  let generated = 0;
  let totalFiles = 0;
  const errors: string[] = [];

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Laravel Stub Generator',
      cancellable: false,
    },
    async (progress) => {
      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i];
        progress.report({
          message: `Generating ${i + 1}/${total}: ${entity}...`,
          increment: (1 / total) * 100,
        });

        try {
          const result = await generateStubs({
            entity,
            version,
            config,
            workspaceRoot,
          });

          totalFiles += result.files.length;
          generated++;

          if (result.errors.length > 0) {
            errors.push(...result.errors.map(e => `[${entity}] ${e}`));
          }
        } catch (err: any) {
          errors.push(`[${entity}] ${err.message}`);
        }
      }
    }
  );

  // Summary
  let msg = `Generated ${totalFiles} files for ${generated}/${total} entities.`;
  if (errors.length > 0) {
    msg += ` Errors: ${errors.length}`;
    vscode.window.showWarningMessage(msg, 'Show Errors').then(sel => {
      if (sel) {
        vscode.window.showInformationMessage(errors.join('\n'));
      }
    });
  } else {
    vscode.window.showInformationMessage(msg);
  }
}
