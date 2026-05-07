import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StubConfig, PresetSchema } from '../models/stubConfiguration';

export async function exportPreset(config: StubConfig): Promise<void> {
  const name = await vscode.window.showInputBox({
    prompt: 'Preset name',
    placeHolder: 'API v1 Standard',
    validateInput: v => v.trim().length === 0 ? 'Enter a name' : undefined,
  });

  if (!name) return;

const preset: PresetSchema = {
    name,
    version: '1.0.0',
    features: config.features,
    route: config.route,
    defaultVersion: config.defaultVersion,
    useVersion: config.useVersion,
  };

  const uri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '', `${name.replace(/\s+/g, '_')}.json`)),
    filters: { 'JSON Preset': ['json'] },
  });

  if (!uri) return;

  fs.writeFileSync(uri.fsPath, JSON.stringify(preset, null, 2), 'utf8');
  vscode.window.showInformationMessage(`Preset exported: ${uri.fsPath}`);
}

export async function importPreset(): Promise<PresetSchema | null> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'JSON Preset': ['json'] },
    openLabel: 'Import Preset',
  });

  if (!uris || uris.length === 0) return null;

  try {
    const raw = fs.readFileSync(uris[0].fsPath, 'utf8');
    const preset = JSON.parse(raw) as PresetSchema;

    if (!preset.features || !preset.defaultVersion) {
      throw new Error('Invalid preset format');
    }

    vscode.window.showInformationMessage(`Preset "${preset.name}" imported successfully`);
    return preset;
  } catch (err: any) {
    vscode.window.showErrorMessage(`Failed to import preset: ${err.message}`);
    return null;
  }
}
