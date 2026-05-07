import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { findMigrationForEntity, parseMigrationFile, ColumnDefinition } from '../utils/schemaParser';

function toPascalVersion(version: string): string {
  return version.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function buildModelContent(entity: string, columns: ColumnDefinition[], version: string): string {
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1);
  const vSeg = toPascalVersion(version);

  const fillable = columns
    .filter(c => !c.isRelation)
    .map(c => `        '${c.name}'`)
    .join(',\n');

  const casts = columns
    .filter(c => c.castType)
    .map(c => `        '${c.name}' => '${c.castType}'`)
    .join(',\n');

  const relations = columns
    .filter(c => c.isRelation && c.relatedModel)
    .map(c => {
      const method = c.name.replace(/_id$/, '');
      return `
    public function ${method}(): \\Illuminate\\Database\\Eloquent\\Relations\\BelongsTo
    {
        return $this->belongsTo(${c.relatedModel}::class);
    }`;
    })
    .join('\n');

  return `<?php

namespace App\\Models\\${vSeg};

use Illuminate\\Database\\Eloquent\\Model;
use Illuminate\\Database\\Eloquent\\Factories\\HasFactory;

class ${pascal} extends Model
{
    use HasFactory;

    protected $fillable = [
${fillable}
    ];

    protected $casts = [
${casts}
    ];
${relations}
}
`;
}

export async function generateFromSchema(workspaceRoot: string, version: string): Promise<void> {
  const entity = await vscode.window.showInputBox({
    prompt: 'Entity name to generate from migration schema',
    placeHolder: 'Post',
    validateInput: v => v.trim().length === 0 ? 'Enter entity name' : undefined,
  });

  if (!entity) return;

  const migrationPath = findMigrationForEntity(workspaceRoot, entity);

  if (!migrationPath) {
    vscode.window.showErrorMessage(
      `No migration file found for "${entity}". Expected: database/migrations/*_create_${entity.toLowerCase()}s_table.php`
    );
    return;
  }

  const columns = parseMigrationFile(migrationPath);

  if (columns.length === 0) {
    vscode.window.showWarningMessage(`No columns found in migration: ${path.basename(migrationPath)}`);
  }

  const content = buildModelContent(entity, columns, version);

  const vSeg = toPascalVersion(version);
  const outputDir = path.join(workspaceRoot, 'app', 'Models', vSeg);
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1);
  const outputPath = path.join(outputDir, `${pascal}.php`);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const choice = await vscode.window.showInformationMessage(
    `Parsed ${columns.length} columns from migration. Generate model?`,
    'Generate',
    'Preview',
    'Cancel'
  );

  if (choice === 'Cancel' || !choice) return;

  if (choice === 'Preview') {
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'php',
    });
    await vscode.window.showTextDocument(doc);
    return;
  }

  fs.writeFileSync(outputPath, content, 'utf8');
  vscode.window.showInformationMessage(`Model generated: ${path.relative(workspaceRoot, outputPath)}`);

  const doc = await vscode.workspace.openTextDocument(outputPath);
  await vscode.window.showTextDocument(doc);
}
