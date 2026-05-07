import * as vscode from 'vscode';
import { execSync } from 'child_process';

export function isGitRepo(workspaceRoot: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: workspaceRoot, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function isGitInstalled(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function gitCommit(
  workspaceRoot: string,
  entity: string,
  files: string[]
): void {
  const fileLines = files.map(f => `- ${f}`).join('\n');
  const message = `generate: ${entity} API components\n\n${fileLines}`;

  // Stage files
  for (const file of files) {
    execSync(`git add "${file}"`, { cwd: workspaceRoot });
  }

  // Commit
  execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, { cwd: workspaceRoot });
}

export async function tryAutoCommit(
  workspaceRoot: string,
  entity: string,
  files: string[]
): Promise<void> {
  if (!isGitInstalled()) {
    vscode.window.showWarningMessage('Git is not installed. Skipping auto-commit.');
    return;
  }

  if (!isGitRepo(workspaceRoot)) {
    vscode.window.showWarningMessage('Not a git repository. Skipping auto-commit.');
    return;
  }

  try {
    gitCommit(workspaceRoot, entity, files);
    vscode.window.showInformationMessage(`Auto-committed ${files.length} files for ${entity}`);
  } catch (err: any) {
    vscode.window.showErrorMessage(`Git commit failed: ${err.message}`);
  }
}
