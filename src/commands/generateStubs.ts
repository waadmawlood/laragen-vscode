import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { StubConfig, MergeStrategy } from '../models/stubConfiguration';
import { GenerationHistory } from '../models/generationHistory';

function loadBuiltinTemplates(): Record<string, string> {
  const templates: Record<string, string> = {};
  const stubsDir = path.join(__dirname, '..', '..', 'stubs');
  
  if (!fs.existsSync(stubsDir)) {
    throw new Error(`Stubs directory not found: ${stubsDir}`);
  }
  
  const files = fs.readdirSync(stubsDir);
  for (const file of files) {
    if (file.endsWith('.stub')) {
      const feature = file.replace('.stub', '');
      const filePath = path.join(stubsDir, file);
      templates[feature] = fs.readFileSync(filePath, 'utf8');
    }
  }
  
  return templates;
}

export const BUILTIN_TEMPLATES: Record<string, string> = loadBuiltinTemplates();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toKebabCase(str: string): string {
  return toSnakeCase(str).replace(/_/g, '-');
}

function toPlural(str: string): string {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (str.endsWith('s')) return str + 'es';
  return str + 's';
}

function toPascalVersion(version: string): string {
  return version
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// ─── Namespace / path builders ────────────────────────────────────────────────

interface VersionedNamespaces {
  controllerNs: string;
  repositoryNs: string;
  resourceNs: string;
  requestNs: string;
  dtoNs: string;
  modelNs: string;
  policyNs: string;
}

const DEFAULT_NAMESPACES: Record<string, string> = {
  controller: 'App\\Http\\Controllers\\Api',
  repository: 'App\\Http\\Repositories',
  resource: 'App\\Http\\Resources',
  store_validation: 'App\\Http\\Requests',
  update_validation: 'App\\Http\\Requests',
  dto: 'App\\Http\\Dtos',
  model: 'App\\Models',
  migration: '',
  policy: 'App\\Policies',
};

const DEFAULT_PATHS: Record<string, string> = {
  controller: 'app/Http/Controllers/Api',
  repository: 'app/Http/Repositories',
  resource: 'app/Http/Resources',
  store_validation: 'app/Http/Requests',
  update_validation: 'app/Http/Requests',
  dto: 'app/Http/Dtos',
  model: 'app/Models',
  migration: 'database/migrations',
  policy: 'app/Policies',
};

function buildVersionedNamespaces(
  version: string,
  useVersion: boolean,
  feature: string,
  customBaseNamespace: string | null,
  featureConfigs?: Record<string, { customBaseNamespace: string | null }>,
  entity?: string
): VersionedNamespaces {
  const vSeg = useVersion ? `\\${toPascalVersion(version)}` : '';
  const pascal = toPascalCase(entity || '');
  
  const getNs = (featureName: string): string => {
    if (featureName === feature && customBaseNamespace !== null && customBaseNamespace !== '') {
      return customBaseNamespace;
    }
    if (featureConfigs && featureConfigs[featureName]) {
      const cfgNs = featureConfigs[featureName].customBaseNamespace;
      if (cfgNs !== null && cfgNs !== '') {
        return cfgNs;
      }
    }
    return DEFAULT_NAMESPACES[featureName] || '';
  };
  
  const entityFolder = (feat: string) => ['dto', 'resource', 'store_validation', 'update_validation'].includes(feat) ? `\\${pascal}` : '';
  
  return {
    controllerNs: `${getNs('controller')}${vSeg}`,
    repositoryNs: `${getNs('repository')}${vSeg}`,
    resourceNs:   `${getNs('resource')}${vSeg}${entityFolder('resource')}`,
    requestNs:    `${getNs('store_validation')}${vSeg}${entityFolder('store_validation')}`,
    dtoNs:        `${getNs('dto')}${vSeg}${entityFolder('dto')}`,
    modelNs:      `${getNs('model')}`,
    policyNs:     `${getNs('policy')}`,
  };
}

function applyPlaceholders(
  template: string,
  entity: string,
  version: string,
  useVersion: boolean,
  feature: string,
  customBaseNamespace: string | null,
  featureConfigs?: Record<string, { customBaseNamespace: string | null }>
): string {
  const pascal    = toPascalCase(entity);
  const camel     = toCamelCase(entity);
  const snake     = toSnakeCase(entity);
  const kebab     = toKebabCase(entity);
  const plural    = toPlural(pascal);
  const pluralLow = toPlural(pascal.toLowerCase());
  const pluralSnk = toPlural(snake);

  const ns = buildVersionedNamespaces(version, useVersion, feature, customBaseNamespace, featureConfigs, entity);

  return template
    .replace(/\{\{EntityName\}\}/g, pascal)
    .replace(/\{\{entityName\}\}/g, camel)
    .replace(/\{\{entity_name\}\}/g, snake)
    .replace(/\{\{entity-name\}\}/g, kebab)
    .replace(/\{\{EntityNames\}\}/g, plural)
    .replace(/\{\{entityNames\}\}/g, pluralLow)
    .replace(/\{\{entity_names\}\}/g, pluralSnk)
    .replace(/\{\{Version\}\}/g, version)
    .replace(/\{\{version\}\}/g, version.toLowerCase())
    .replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString())
    .replace(/\{\{ControllerNamespace\}\}/g, ns.controllerNs)
    .replace(/\{\{RepositoryNamespace\}\}/g, ns.repositoryNs)
    .replace(/\{\{ResourceNamespace\}\}/g, ns.resourceNs)
    .replace(/\{\{RequestNamespace\}\}/g, ns.requestNs)
    .replace(/\{\{DtoNamespace\}\}/g, ns.dtoNs)
    .replace(/\{\{ModelNamespace\}\}/g, ns.modelNs)
    .replace(/\{\{PolicyNamespace\}\}/g, ns.policyNs)
    .replace(/\{\{\s*namespace\s*\}\}/g, ns.controllerNs)
    .replace(/\{\{\s*class\s*\}\}/g, pascal)
    .replace(/\{\{\s*rootNamespace\s*\}\}/g, 'App\\')
    .replace(/\{\{\s*model\s*\}\}/g, pascal)
    .replace(/\{\{\s*modelVariable\s*\}\}/g, camel)
    .replace(/\{\{\s*table\s*\}\}/g, pluralSnk);
}

// ─── Stub resolver ────────────────────────────────────────────────────────────

export function resolveStub(
  feature: string,
  useCustomStub: boolean,
  customStubPath: string,
  workspaceRoot: string
): { content: string; source: string } {
  if (useCustomStub && customStubPath.trim() !== '') {
    const abs = path.isAbsolute(customStubPath)
      ? customStubPath
      : path.join(workspaceRoot, customStubPath);
    if (fs.existsSync(abs)) {
      return { content: fs.readFileSync(abs, 'utf8'), source: `custom:${abs}` };
    }
    throw new Error(`Custom stub not found: ${abs}`);
  }

  const builtin = BUILTIN_TEMPLATES[feature];
  if (builtin) {
    return { content: builtin, source: 'extension' };
  }

  throw new Error(`No stub found for feature "${feature}" in this extension.`);
}

// ─── Output path builder ──────────────────────────────────────────────────────

export function getOutputPath(
  feature: string,
  entity: string,
  version: string,
  useVersion: boolean,
  workspaceRoot: string,
  customBasePath: string | null,
  routeFile?: string
): string {
  const pascal = toPascalCase(entity);
  const snake  = toSnakeCase(entity);
  const plural = toPlural(snake);
  const vSeg   = useVersion ? toPascalVersion(version) : '';

  const basePath = (customBasePath !== null && customBasePath !== '') ? customBasePath : (DEFAULT_PATHS[feature] || '');

const paths: Record<string, string> = {
    model:             path.join(workspaceRoot, basePath, `${pascal}.php`),
    migration:         path.join(workspaceRoot, basePath, `${Date.now()}_create_${plural}_table.php`),
    controller:        path.join(workspaceRoot, basePath, vSeg ? vSeg : '', `${pascal}Controller.php`),
    repository:        path.join(workspaceRoot, basePath, vSeg ? vSeg : '', `${pascal}Repository.php`),
    policy:            path.join(workspaceRoot, basePath, `${pascal}Policy.php`),
    route:             path.join(workspaceRoot, 'routes', routeFile || `api.php`),
    resource:          path.join(workspaceRoot, basePath, vSeg ? vSeg : '', pascal, `${pascal}Resource.php`),
    dto:               path.join(workspaceRoot, basePath, vSeg ? vSeg : '', pascal, `${pascal}Data.php`),
    store_validation:        path.join(workspaceRoot, basePath, vSeg ? vSeg : '', pascal, `${pascal}StoreRequest.php`),
    update_validation: path.join(workspaceRoot, basePath, vSeg ? vSeg : '', pascal, `${pascal}UpdateRequest.php`),
  };

  return paths[feature] ?? path.join(workspaceRoot, `${pascal}_${feature}.php`);
}

// ─── Merge helper ─────────────────────────────────────────────────────────────

function handleMerge(outputPath: string, strategy: MergeStrategy, content: string): 'written' | 'skipped' {
  if (!fs.existsSync(outputPath)) return 'written';

  switch (strategy) {
    case 'skip':    return 'skipped';
    case 'replace': return 'written';
    case 'backup': {
      fs.copyFileSync(outputPath, outputPath + '.bak');
      return 'written';
    }
    case 'append': {
      fs.writeFileSync(outputPath, fs.readFileSync(outputPath, 'utf8') + '\n\n' + content, 'utf8');
      return 'written';
    }
  }
}

// ─── Main generate function ───────────────────────────────────────────────────

export interface GenerateOptions {
  entity: string;
  version: string;
  config: StubConfig;
  workspaceRoot: string;
  preview?: boolean;
}

export interface GenerateResult {
  files: string[];
  previews: Record<string, string>;
  skipped: string[];
  errors: string[];
  stubSources: Record<string, string>;
}

export async function generateStubs(options: GenerateOptions): Promise<GenerateResult> {
  const { entity, version, config, workspaceRoot, preview = false } = options;
  const useVersion = config.useVersion ?? true;
  const result: GenerateResult = { files: [], previews: {}, skipped: [], errors: [], stubSources: {} };

  for (const [feature, featureConfig] of Object.entries(config.features)) {
    if (!featureConfig.enabled) continue;

    try {
      const { content: rawTemplate, source } = resolveStub(
        feature,
        featureConfig.useCustomStub,
        featureConfig.customStubPath,
        workspaceRoot
      );
      const content = applyPlaceholders(
        rawTemplate,
        entity,
        version,
        useVersion,
        feature,
        featureConfig.customBaseNamespace || null,
        config.features as Record<string, { customBaseNamespace: string | null }>
      );
      result.stubSources[feature] = source;

      const outputPath = getOutputPath(
        feature,
        entity,
        version,
        useVersion,
        workspaceRoot,
        featureConfig.customBasePath || null,
        config.route?.file
      );

      if (preview) {
        result.previews[feature] = content;
        continue;
      }

      const mergeResult = handleMerge(outputPath, config.mergeStrategy, content);

      if (mergeResult === 'skipped') {
        result.skipped.push(outputPath);
        continue;
      }

      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (config.mergeStrategy !== 'append') {
        fs.writeFileSync(outputPath, content, 'utf8');
      }

      result.files.push(outputPath);

      if (config.autoOpenFiles) {
        const doc = await vscode.workspace.openTextDocument(outputPath);
        await vscode.window.showTextDocument(doc, { preview: false });
      }
    } catch (err: any) {
      result.errors.push(`[${feature}] ${err.message}`);
    }
  }

if (config.route?.enabled) {
    try {
      const routeFile = config.route.file || 'api.php';
      const routePath = path.join(workspaceRoot, 'routes', routeFile);

      const pascal = toPascalCase(entity);
      const controllerConfig = config.features.controller;
      const controllerBaseNs = controllerConfig.customBaseNamespace 
        ? controllerConfig.customBaseNamespace 
        : DEFAULT_NAMESPACES.controller;
      const controllerNs = `${controllerBaseNs}${useVersion ? '\\' + toPascalVersion(version) : ''}`;
      const useStatement = `use ${controllerNs}\\${pascal}Controller;`;
      const routeLine = `Route::apiResource('${toSnakeCase(entity)}s', ${pascal}Controller::class);`;

      if (preview) {
        result.previews['route'] = `// Use: ${useStatement}\n// Route: ${routeLine}`;
      } else {
        const dir = path.dirname(routePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        let existingContent = '';
        let needsUseStatement = true;
        let needsRouteLine = true;

        if (fs.existsSync(routePath)) {
          // existingContent = fs.readFileSync(routePath, 'utf8');
          // needsUseStatement = !existingContent.includes(useStatement);
          // needsRouteLine = !existingContent.includes(routeLine);

          let content = fs.readFileSync(routePath, 'utf8');

          const lines = content.split('\n');

          const hasUseStatement = content.includes(useStatement);
          const hasRouteLine = content.includes(routeLine);

          // ✅ Ensure file has at least 3 lines
          while (lines.length < 3) {
            lines.push('');
          }

          // ✅ Insert use statement at line 3 (index 2)
          if (!hasUseStatement) {
            lines.splice(2, 0, useStatement);
          }

          // ✅ Add route line at the end
          if (!hasRouteLine) {
            // Remove trailing empty lines first
            while (lines.length && lines[lines.length - 1].trim() === '') {
              lines.pop();
            }

            lines.push(routeLine);

            // ✅ Ensure ONE empty line at the end
            lines.push('');
          }

          fs.writeFileSync(routePath, lines.join('\n'), 'utf8');
          result.files.push(routePath);
        }

        if (config.autoOpenFiles) {
          const doc = await vscode.workspace.openTextDocument(routePath);
          await vscode.window.showTextDocument(doc, { preview: false });
        }
      }
    } catch (err: any) {
      result.errors.push(`[route] ${err.message}`);
    }
  }

  if (!preview && result.files.length > 0) {
    const history = new GenerationHistory(workspaceRoot);
    history.add(
      entity,
      version,
      result.files.map(f => path.relative(workspaceRoot, f)),
      Object.keys(config.features).filter(k => config.features[k as keyof typeof config.features].enabled)
    );
  }

  return result;
}

export interface ExportStubsResult {
  folderExists: boolean;
  folderPath: string;
}

export async function exportStubs(workspaceRoot: string, folderName: string = 'stubs'): Promise<ExportStubsResult> {
  const stubsDir = path.join(workspaceRoot, folderName);
  const folderExists = fs.existsSync(stubsDir);
  
  if (!folderExists) {
    fs.mkdirSync(stubsDir, { recursive: true });
  }

  const features = Object.keys(BUILTIN_TEMPLATES);

  for (const feature of features) {
    const stubContent = BUILTIN_TEMPLATES[feature];
    const stubPath = path.join(stubsDir, `${feature}.stub`);
    fs.writeFileSync(stubPath, stubContent, 'utf8');
  }

  return {
    folderExists,
    folderPath: stubsDir
  };
}
