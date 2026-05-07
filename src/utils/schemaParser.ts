import * as fs from 'fs';
import * as path from 'path';

export interface ColumnDefinition {
  name: string;
  migrationType: string;
  phpType: string;
  castType: string | null;
  isRelation: boolean;
  relatedModel?: string;
}

const TYPE_MAP: Record<string, { phpType: string; castType: string | null; isRelation: boolean }> = {
  string:       { phpType: 'string',  castType: null,       isRelation: false },
  text:         { phpType: 'string',  castType: null,       isRelation: false },
  longText:     { phpType: 'string',  castType: null,       isRelation: false },
  integer:      { phpType: 'int',     castType: 'integer',  isRelation: false },
  bigInteger:   { phpType: 'int',     castType: 'integer',  isRelation: false },
  unsignedBigInteger: { phpType: 'int', castType: 'integer', isRelation: false },
  tinyInteger:  { phpType: 'int',     castType: 'integer',  isRelation: false },
  smallInteger: { phpType: 'int',     castType: 'integer',  isRelation: false },
  float:        { phpType: 'float',   castType: 'float',    isRelation: false },
  double:       { phpType: 'float',   castType: 'double',   isRelation: false },
  decimal:      { phpType: 'float',   castType: 'decimal:2',isRelation: false },
  boolean:      { phpType: 'bool',    castType: 'boolean',  isRelation: false },
  date:         { phpType: 'Carbon',  castType: 'date',     isRelation: false },
  dateTime:     { phpType: 'Carbon',  castType: 'datetime', isRelation: false },
  timestamp:    { phpType: 'Carbon',  castType: 'datetime', isRelation: false },
  json:         { phpType: 'array',   castType: 'array',    isRelation: false },
  jsonb:        { phpType: 'array',   castType: 'array',    isRelation: false },
  uuid:         { phpType: 'string',  castType: null,       isRelation: false },
  foreignId:    { phpType: 'int',     castType: 'integer',  isRelation: true  },
  foreignUuid:  { phpType: 'string',  castType: null,       isRelation: true  },
};

export function parseMigrationFile(filePath: string): ColumnDefinition[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const columns: ColumnDefinition[] = [];

  // Match $table->type('name') and $table->foreignId('name')
  const regex = /\$table->(\w+)\(\s*['"](\w+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const [, migrationType, name] = match;

    // Skip meta columns
    if (['timestamps', 'softDeletes', 'id', 'rememberToken'].includes(migrationType)) {
      continue;
    }

    const typeInfo = TYPE_MAP[migrationType] ?? { phpType: 'mixed', castType: null, isRelation: false };

    let relatedModel: string | undefined;
    if (typeInfo.isRelation) {
      // e.g., user_id -> User
      relatedModel = name.replace(/_id$/, '').replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      relatedModel = relatedModel.charAt(0).toUpperCase() + relatedModel.slice(1);
    }

    columns.push({
      name,
      migrationType,
      phpType: typeInfo.phpType,
      castType: typeInfo.castType,
      isRelation: typeInfo.isRelation,
      relatedModel,
    });
  }

  return columns;
}

export function findMigrationForEntity(workspaceRoot: string, entity: string): string | null {
  const migrationsDir = path.join(workspaceRoot, 'database', 'migrations');
  if (!fs.existsSync(migrationsDir)) return null;

  const tableName = entity.toLowerCase() + 's';
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.php'));

  // Look for create_{tableName}_table
  const match = files.find(f =>
    f.includes(`create_${tableName}_table`) || f.includes(`_${tableName}_`)
  );

  return match ? path.join(migrationsDir, match) : null;
}
