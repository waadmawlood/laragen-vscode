# Laravel Stub Generator - Advanced Features Implementation Plan

## Overview

This document outlines the phased implementation of advanced features to transform the Laravel Stub Generator extension from a basic stub generator into a comprehensive Laravel API scaffolding tool.

---

## Current State

### Existing Features
- Generates 9 Laravel components: model, migration, controller, repository, policy, route, resource, dto, validation
- Sidebar UI with feature toggles and custom stub paths
- Version support (v1, v2, etc.)
- Handlebars templating with placeholders
- Project structure visualization
- Configuration persistence per workspace

### Per-Feature Custom Base Path & Namespace (NEW)
Each feature now supports custom base path and custom base namespace:
- **customBasePath**: Override default output path (e.g., `app/Http/Controllers/Api`)
- **customBaseNamespace**: Override default namespace (e.g., `App\Http\Controllers\Api`)

Priority: Custom → Default → Fallback

Default paths and namespaces:
| Feature | Default Path | Default Namespace |
|---------|--------------|-------------------|
| controller | `app/Http/Controllers/Api` | `App\Http\Controllers\Api` |
| repository | `app/Http/Repositories` | `App\Http\Repositories` |
| resource | `app/Http/Resources` | `App\Http\Resources` |
| store_validation | `app/Http/Requests` | `App\Http\Requests` |
| update_validation | `app/Http/Requests` | `App\Http\Requests` |
| dto | `app/Http/Dtos` | `App\Http\Dtos` |
| model | `app/Models` | `App\Models` |
| policy | `app/Policies` | `App\Policies` |
| migration | `database/migrations` | (none) |

**Version Integration**: When `useVersion` is enabled:
- Path: `customBasePath/V1/` or `defaultPath/V1/`
- Namespace: `customBaseNamespace\V1` or `defaultNamespace\V1`

**Cross-referencing**: When one feature references another (e.g., controller uses repository), it uses the referenced feature's namespace (custom or default).

### Current Stubs
| File | Status | Notes |
|------|--------|-------|
| `model.stub` | Updated | Uses `{{ModelNamespace}}` placeholder |
| `migration.stub` | Ready | Basic migration |
| `controller.stub` | Updated | Uses `{{namespace}}`, `{{RequestNamespace}}`, `{{ResourceNamespace}}`, `{{RepositoryNamespace}}` |
| `repository.stub` | Updated | Uses `{{RepositoryNamespace}}` placeholder |
| `policy.stub` | Updated | Uses `{{PolicyNamespace}}`, `{{ModelNamespace}}` placeholders |
| `route.stub` | Ready | API route prefix |
| `resource.stub` | Updated | Uses `{{ResourceNamespace}}` placeholder |
| `dto.stub` | Updated | Uses `{{DtoNamespace}}` placeholder |
| `store_validation.stub` | Updated | Uses `{{RequestNamespace}}` placeholder |
| `update_validation.stub` | Updated | Uses `{{RequestNamespace}}` placeholder |

### Template Placeholders
| Placeholder | Description |
|-------------|-------------|
| `{{EntityName}}` | PascalCase entity name (e.g., `Post`) |
| `{{entityName}}` | camelCase entity name (e.g., `post`) |
| `{{entity_name}}` | snake_case entity name (e.g., `post`) |
| `{{EntityNames}}` | PascalCase plural (e.g., `Posts`) |
| `{{entityNames}}` | camelCase plural (e.g., `posts`) |
| `{{entity_names}}` | snake_case plural (e.g., `posts`) |
| `{{Version}}` | Version string (e.g., `v1`) |
| `{{namespace}}` | Controller's namespace (custom or default) |
| `{{ControllerNamespace}}` | Controller namespace |
| `{{RepositoryNamespace}}` | Repository namespace |
| `{{ResourceNamespace}}` | Resource namespace |
| `{{RequestNamespace}}` | Request namespace (validation) |
| `{{DtoNamespace}}` | DTO namespace |
| `{{ModelNamespace}}` | Model namespace |
| `{{PolicyNamespace}}` | Policy namespace |

### FeatureConfig Structure
```typescript
interface FeatureConfig {
  enabled: boolean;
  useCustomStub: boolean;
  customStubPath: string;
  customBasePath: string;      // NEW: custom output path
  customBaseNamespace: string; // NEW: custom namespace
}
```

---

## Implementation Roadmap

### Phase 1: Core Generation Enhancements
**Priority: HIGH** - Immediate productivity gains

#### 1.1 Full CRUD Request Generation
**Problem**: Only `StoreRequest` is generated, but controller requires both `StoreRequest` and `UpdateRequest`.

**Solution**: 
- Add `update_validation` to `StubConfig` interface in `src/models/stubConfiguration.ts`
- Add to default config with stub path `./stubs/update_validation.stub`
- Update `getOutputPath()` in `src/commands/generateStubs.ts` to handle update request path
- Add toggle in sidebar UI

**Files Modified**:
- `src/models/stubConfiguration.ts`
- `src/commands/generateStubs.ts`
- `src/stubGeneratorProvider.ts`

#### 1.2 Batch Entity Generation
**Problem**: Currently can only generate one entity at a time.

**Solution**:
- Create new command `laravel-stub-generator.batchGenerate`
- Input method: QuickPick multi-select UI or comma-separated input
- Process entities sequentially with progress indicator
- Option to use same version for all or prompt per entity

**New Files**:
- `src/commands/batchGenerate.ts`

**Flow**:
```
1. User triggers "Batch Generate" command
2. Input: "User, Post, Comment" or multi-select
3. Optional version input (applies to all)
4. Progress: "Generating 3/3: Post..."
5. Summary: "Generated 24 files for 3 entities"
```

#### 1.3 Template Preview
**Problem**: Users can't see the generated code before files are written.

**Solution**:
- Add "Preview" button in sidebar before generation
- Render template with current placeholders (no file writing)
- Display in new webview panel with syntax highlighting (basic HTML pre/code block)
- Options: "Generate" or "Cancel"

**New Files**:
- `src/webview/previewProvider.ts`

**Webview Features**:
- Syntax highlighting (basic - no heavy library)
- Copy to clipboard button
- Download as file option

---

### Phase 2: Laravel Integration
**Priority: HIGH** - Deeper framework knowledge

#### 2.1 Laravel Version Detection
**Problem**: Templates may need to differ based on Laravel version (e.g., 9 vs 10 vs 11).

**Solution**:
- Read `composer.json` from workspace
- Extract `laravel/framework` version
- Use version to:
  - Select appropriate stub templates
  - Adjust PHP code (e.g., return types changed in v10)
  - Set default output paths

**New Files**:
- `src/utils/laravelDetector.ts`

**Detection Priority**:
1. User-configured version (manual override)
2. Auto-detected from `composer.json`
3. Default to latest (v11)

#### 2.2 Schema-to-Model Generation
**Problem**: Users may want to update models based on existing migrations.

**Solution**:
- Parse migration files in `database/migrations/`
- Extract column definitions: `$table->string('email')`, `$table->foreignId('user_id')`, etc.
- Generate/update model with: `$fillable`, `$casts`, relationships
- Option to update existing model or create new

**New Files**:
- `src/commands/generateFromSchema.ts`
- `src/utils/schemaParser.ts`

**Supported Column Types**:
| Migration Type | PHP Type | Cast Type |
|---------------|---------|----------|
| `string` | `string` | - |
| `text` | `string` | - |
| `integer`, `bigInteger` | `int` | `integer` |
| `boolean` | `bool` | `boolean` |
| `date`, `datetime` | Carbon | `datetime` |
| `json` | `array` | `array` |
| `foreignId` | - | (creates relationship) |

#### 2.3 API Documentation Generation
**Problem**: Need to generate API docs from routes and DTOs.

**Solution**:
- Parse route definitions from generated route stub
- Extract DTO/resource field definitions
- Generate OpenAPI 3.0 JSON (`openapi.json`)
- Include: paths, parameters, request/response schemas

**New Files**:
- `src/commands/generateApiDocs.ts`

**Output**:
```json
{
  "openapi": "3.0.0",
  "info": { "title": "API", "version": "v1" },
  "paths": {
    "/users": {
      "get": { "tags": ["User"], "responses": { "200": { ... } } },
      "post": { "tags": ["User"], "requestBody": { ... } }
    }
  }
}
```

---

### Phase 3: Workflow & Safety Features
**Priority: MEDIUM** - Production readiness

#### 3.1 Generation History & Rollback
**Problem**: No way to undo generated files.

**Solution**:
- Store history in `.vscode/laravel-stubs.history.json`
- Track: timestamp, entity, version, files generated, content hash
- Provide "Rollback" command to delete generated files

**New Files**:
- `src/models/generationHistory.ts`

**History Schema**:
```json
{
  "generations": [
    {
      "id": "uuid",
      "timestamp": "2024-01-15T10:30:00Z",
      "entity": "Post",
      "version": "v1",
      "files": [
        "app/Models/v1/Post.php",
        "app/Http/Controllers/Api/v1/PostController.php"
      ],
      "features": ["model", "controller", "repository"]
    }
  ]
}
```

#### 3.2 Git Auto-Commit
**Problem**: After generation, files need to be committed manually.

**Solution**:
- Optional checkbox in generation UI: "Auto-commit"
- Generate conventional commit message
- Run `git add` then `git commit`
- Handle case: git not installed, not a repo, uncommitted changes

**New Files**:
- `src/commands/gitOperations.ts`

**Commit Message Format**:
```
generate: Post API components

- Models/Post.php
- Controllers/PostController.php
- Requests/PostStoreRequest.php
- Requests/PostUpdateRequest.php
```

#### 3.3 Merge Strategies
**Problem**: Unknown behavior when target file already exists.

**Solution**: Add strategy selection in UI:
| Strategy | Behavior |
|----------|----------|
| `Skip` | Do not overwrite, log skipped file |
| `Replace` | Overwrite existing file |
| `Backup` | Rename existing to `.bak` then write |
| `Append` | Append new content (for routes) |

**Default**: `Backup` (safest)

**UI Component**:
```html
<select id="mergeStrategy">
  <option value="backup">Backup (Recommended)</option>
  <option value="skip">Skip Existing</option>
  <option value="replace">Replace</option>
  <option value="append">Append</option>
</select>
```

#### 3.4 Presets Export/Import
**Problem**: Same config needs to be shared across team or projects.

**Solution**:
- Export current config to JSON file
- Import from file or clipboard
- Include default stub paths

**New Files**:
- `src/commands/presets.ts`

**Commands**:
- `laravel-stub-generator.exportPreset`
- `laravel-stub-generator.importPreset`

**Preset Schema**:
```json
{
  "name": "API v1 Standard",
  "version": "1.0.0",
  "features": {
    "model": { "enabled": true, "stubPath": "./stubs/model.stub" },
    "controller": { "enabled": true, "stubPath": "./stubs/controller.stub" }
  },
  "defaultVersion": "v1"
}
```

---

### Phase 4: UX Polish
**Priority: LOWER** - Nice-to-have improvements

#### 4.1 Auto-open Generated Files
Add option to open generated files in editor after generation.

**Code**:
```typescript
const doc = await vscode.workspace.openTextDocument(outputPath);
await vscode.window.showTextDocument(doc);
```

#### 4.2 Progress Notifications
Use `vscode.window.withProgress` for batch operations:

```typescript
await vscode.window.withProgress({
  location: vscode.ProgressLocation.Notification,
  title: 'Generating stubs',
  cancellable: false
}, async (progress) => {
  for (let i = 0; i < entities.length; i++) {
    progress.report({ message: `Generating ${entities[i]}...`, increment: (i / total) * 100 });
    await generateEntity(entities[i]);
  }
});
```

#### 4.3 File Watcher
Watch migration folder, notify on changes:

```typescript
const watcher = vscode.workspace.createFileSystemWatcher('**/database/migrations/*.php');
watcher.onDidChange((uri) => {
  vscode.window.showInformationMessage('Migration changed. Regenerate model?');
});
```

#### 4.4 Named Presets
Multiple saved configurations:

```typescript
// Save named preset
vscode.commands.registerCommand('laravel-stub-generator.savePreset', async () => {
  const name = await vscode.window.showInputBox({ placeHolder: 'Preset name' });
  await stubConfig.savePreset(name);
});

// Load preset
vscode.commands.registerCommand('laravel-stub-generator.loadPreset', async () => {
  const presets = await stubConfig.getPresets();
  const choice = await vscode.window.showQuickPick(presets.map(p => p.name));
  await stubConfig.loadPreset(choice);
});
```

---

## File Structure After Implementation

```
laravel-stub-generator/
├── src/
│   ├── extension.ts                  (modified)
│   ├── stubGeneratorProvider.ts      (modified)
│   ├── commands/
│   │   ├── generateStubs.ts        (modified)
│   │   ├── batchGenerate.ts        (NEW)
│   │   ├── generateFromSchema.ts  (NEW)
│   │   ├── generateApiDocs.ts     (NEW)
│   │   ├── gitOperations.ts      (NEW)
│   │   └── presets.ts          (NEW)
│   ├── models/
│   │   ├── stubConfiguration.ts (modified)
│   │   └── generationHistory.ts (NEW)
│   ├── utils/
│   │   └── laravelDetector.ts  (NEW)
│   └── webview/
│       └── previewProvider.ts   (NEW)
├── stubs/
│   ├── model.stub
│   ├── migration.stub
│   ├── controller.stub
│   ├── repository.stub
│   ├── policy.stub
│   ├── resource.stub
│   ├── dto.stub
│   ├── store_validation.stub
│   └── update_validation.stub   (integrated)
└── package.json                  (modified - new commands)
```

---

## Summary

### Completed Features
- **Custom Base Path & Namespace (v2.1)**: Per-feature custom base path and custom base namespace support
  - Each feature can have its own custom output path and namespace
  - Priority: Custom → Default → Fallback
  - Cross-referencing uses referenced feature's namespace
  - Version integration: V1 appended to path/namespace when enabled

| Phase | Features | New Files | Complexity |
|-------|----------|----------|-------------|
| 1 | CRUD Fix + Batch + Preview | 2 | Medium |
| 2 | Laravel Detection + Schema + API Docs | 3 | High |
| 3 | History + Git + Merge + Presets | 4 | Medium |
| 4 | Polish (auto-open, progress, watcher) | 1 | Low |
| **Total** | | **~10** | |

---

## Next Steps

1. **Confirm Phase 1 Start**: Should implementation begin with Phase 1 (Core Enhancements)?
2. **Confirm Priorities**: Any reordering of phases?
3. **Clarification**:
   - Preferred batch input format (comma-separated vs QuickPick)?
   - Merge strategy default (Backup, Skip, Replace)?
   - Accept ~10 new source files?