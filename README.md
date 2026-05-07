# Laravel Stub Generator

<p align="center">
  <img src="media/icon.png" width="100" alt="Laravel Stub Generator">
</p>

A powerful VS Code extension for generating Laravel API components with full control over paths and namespaces.

---

## Features

### 🚀 Core Generation
- **9 Components** — Model, Migration, Controller, Repository, Policy, Resource, DTO, StoreRequest, UpdateRequest
- **Batch Generation** — Generate multiple entities at once
- **Preview Mode** — Preview generated code before writing files

### ⚙️ Flexible Configuration
- **Custom Base Path** — Set custom output path per feature (e.g., `app/Http/Controllers/Api`)
- **Custom Base Namespace** — Set custom namespace per feature (e.g., `App\Http\Controllers\Api`)
- **Entity Folders** — DTO, Validation, and Resource files are organized in entity subfolders

### 🔄 Version Support
- Enable/disable versioning per project
- Version segment appended to paths and namespaces (e.g., `V1`, `V2`)
- Example: `app/Http/Controllers/Api/V1/PostController.php`

### 🛡️ Workflow Features
- **Merge Strategies** — Backup (default), Skip, Replace, Append
- **Git Auto-Commit** — Optional automatic commit after generation
- **Rollback** — One-click deletion of last generated files
- **Presets** — Export/import configurations as JSON

---

## Installation

```bash
# Clone the repository
git clone https://github.com/waadmawlood/laragen-vscode.git
cd laragen-vscode

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Package as VSIX (optional)
npm run package

# Install the extension
code --install-extension laravel-stub-generator-1.0.0.vsix
```

---

## Quick Start

1. Open a Laravel project in VS Code
2. Click the **Laravel Stub Generator** icon in the Activity Bar
3. Enter an **Entity Name** (e.g., `Post`)
4. Click **Generate**

---

## Generated Structure

### Default Paths

| Component | Path |
|-----------|------|
| Model | `app/Models/Post.php` |
| Migration | `database/migrations/{timestamp}_create_posts_table.php` |
| Controller | `app/Http/Controllers/Api/V1/PostController.php` |
| Repository | `app/Repositories/V1/PostRepository.php` |
| Policy | `app/Policies/PostPolicy.php` |
| Resource | `app/Http/Resources/V1/Post/PostResource.php` |
| DTO | `app/DTOs/V1/Post/PostDTO.php` |
| StoreRequest | `app/Http/Requests/V1/Post/PostStoreRequest.php` |
| UpdateRequest | `app/Http/Requests/V1/Post/PostUpdateRequest.php` |

### With Custom Path/Namespace

You can customize paths and namespaces per feature:

```
Custom Path:     app/Http/Controllers/Api
Custom Namespace: App\Http\Controllers\Api

Result:
  Path:     app/Http/Controllers/Api/V1/PostController.php
  Namespace: App\Http\Controllers\Api\V1
```

---

## Configuration

### Components Panel

Each feature supports:
- **Enabled** — Toggle feature generation
- **Custom Stub** — Use your own `.stub` template
- **Custom Base Path** — Override default output path
- **Custom Base Namespace** — Override default namespace

### Default Paths & Namespaces

| Feature | Default Path | Default Namespace |
|---------|--------------|-------------------|
| controller | `app/Http/Controllers/Api` | `App\Http\Controllers\Api` |
| repository | `app/Repositories` | `App\Repositories` |
| resource | `app/Http/Resources` | `App\Http\Resources` |
| validation | `app/Http/Requests` | `App\Http\Requests` |
| dto | `app/DTOs` | `App\DTOs` |
| model | `app/Models` | `App\Models` |
| policy | `app/Policies` | `App\Policies` |

---

## Template Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{{EntityName}}` | PascalCase name | `Post` |
| `{{entityName}}` | camelCase name | `post` |
| `{{entity_name}}` | snake_case name | `post` |
| `{{entityNames}}` | camelCase plural | `posts` |
| `{{entity_names}}` | snake_case plural | `posts` |
| `{{Version}}` | Version segment | `V1` |
| `{{version}}` | lowercase version | `v1` |
| `{{namespace}}` | Feature namespace | `App\Http\Controllers\Api\V1` |
| `{{ControllerNamespace}}` | Controller namespace | `App\Http\Controllers\Api\V1` |
| `{{RepositoryNamespace}}` | Repository namespace | `App\Repositories\V1` |
| `{{ResourceNamespace}}` | Resource namespace | `App\Http\Resources\V1` |
| `{{RequestNamespace}}` | Request namespace | `App\Http\Requests\V1` |
| `{{DtoNamespace}}` | DTO namespace | `App\DTOs\V1` |
| `{{ModelNamespace}}` | Model namespace | `App\Models` |
| `{{PolicyNamespace}}` | Policy namespace | `App\Policies` |

---

## Commands

| Command | Description |
|---------|-------------|
| `Laravel: Generate Laravel Stubs` | Open sidebar |
| `Laravel: Batch Generate` | Generate multiple entities |
| `Laravel: Schema → Model` | Parse migration to model |
| `Laravel: Generate OpenAPI Docs` | Create OpenAPI JSON |
| `Laravel: Rollback Last` | Delete last generated files |
| `Laravel: Export Preset` | Save config to JSON |
| `Laravel: Import Preset` | Load config from JSON |

---

## Merge Strategies

| Strategy | Behavior |
|----------|----------|
| **Backup** *(default)* | Rename existing to `.bak` |
| Skip | Do not overwrite |
| Replace | Overwrite directly |
| Append | Append content (routes) |

---

## Requirements

- VS Code 1.85+
- Node.js 18+

---

## License

MIT License