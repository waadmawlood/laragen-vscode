import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export interface GenerationRecord {
  id: string;
  timestamp: string;
  entity: string;
  version: string;
  files: string[];
  features: string[];
}

export interface HistorySchema {
  generations: GenerationRecord[];
}

export class GenerationHistory {
  private historyPath: string;

  constructor(workspaceRoot: string) {
    this.historyPath = path.join(workspaceRoot, '.vscode', 'laravel-stubs.history.json');
  }

  private read(): HistorySchema {
    try {
      if (fs.existsSync(this.historyPath)) {
        const raw = fs.readFileSync(this.historyPath, 'utf8');
        return JSON.parse(raw) as HistorySchema;
      }
    } catch {
      // ignore
    }
    return { generations: [] };
  }

  private write(history: HistorySchema): void {
    const dir = path.dirname(this.historyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.historyPath, JSON.stringify(history, null, 2), 'utf8');
  }

  add(entity: string, version: string, files: string[], features: string[]): GenerationRecord {
    const history = this.read();
    const record: GenerationRecord = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      entity,
      version,
      files,
      features,
    };
    history.generations.unshift(record);
    // Keep last 50
    history.generations = history.generations.slice(0, 50);
    this.write(history);
    return record;
  }

  getLast(): GenerationRecord | undefined {
    return this.read().generations[0];
  }

  getAll(): GenerationRecord[] {
    return this.read().generations;
  }

  async rollback(record: GenerationRecord): Promise<string[]> {
    const deleted: string[] = [];
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';

    for (const file of record.files) {
      const fullPath = path.isAbsolute(file) ? file : path.join(workspaceRoot, file);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        deleted.push(file);
      }
    }

    // Remove from history
    const history = this.read();
    history.generations = history.generations.filter(g => g.id !== record.id);
    this.write(history);

    return deleted;
  }
}
