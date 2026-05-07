import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface OpenApiDoc {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, any>;
  components: { schemas: Record<string, any> };
}

function buildPaths(entity: string, version: string): Record<string, any> {
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1);
  const lower = entity.toLowerCase();
  const plural = lower + 's';
  const tag = pascal;

  return {
    [`/${version}/${plural}`]: {
      get: {
        tags: [tag],
        summary: `List all ${pascal} resources`,
        operationId: `${lower}Index`,
        parameters: [
          { name: 'per_page', in: 'query', schema: { type: 'integer', default: 15 } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        ],
        responses: {
          '200': {
            description: `Paginated list of ${pascal}`,
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}Collection` } } },
          },
        },
      },
      post: {
        tags: [tag],
        summary: `Create a new ${pascal}`,
        operationId: `${lower}Store`,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}StoreRequest` } } },
        },
        responses: {
          '201': {
            description: `${pascal} created`,
            content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}Resource` } } },
          },
          '422': { description: 'Validation error' },
        },
      },
    },
    [`/${version}/${plural}/{id}`]: {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
      get: {
        tags: [tag],
        summary: `Get a ${pascal} by ID`,
        operationId: `${lower}Show`,
        responses: {
          '200': { description: 'Success', content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}Resource` } } } },
          '404': { description: 'Not found' },
        },
      },
      put: {
        tags: [tag],
        summary: `Update a ${pascal}`,
        operationId: `${lower}Update`,
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}UpdateRequest` } } },
        },
        responses: {
          '200': { description: 'Success', content: { 'application/json': { schema: { $ref: `#/components/schemas/${pascal}Resource` } } } },
          '404': { description: 'Not found' },
          '422': { description: 'Validation error' },
        },
      },
      delete: {
        tags: [tag],
        summary: `Delete a ${pascal}`,
        operationId: `${lower}Destroy`,
        responses: {
          '204': { description: 'Deleted' },
          '404': { description: 'Not found' },
        },
      },
    },
  };
}

function buildSchemas(entity: string): Record<string, any> {
  const pascal = entity.charAt(0).toUpperCase() + entity.slice(1);
  return {
    [`${pascal}Resource`]: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
    [`${pascal}Collection`]: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: `#/components/schemas/${pascal}Resource` } },
        meta: {
          type: 'object',
          properties: {
            current_page: { type: 'integer' },
            total: { type: 'integer' },
            per_page: { type: 'integer' },
          },
        },
      },
    },
    [`${pascal}StoreRequest`]: {
      type: 'object',
      required: [],
      properties: {},
    },
    [`${pascal}UpdateRequest`]: {
      type: 'object',
      properties: {},
    },
  };
}

export async function generateApiDocs(workspaceRoot: string, version: string): Promise<void> {
  const input = await vscode.window.showInputBox({
    prompt: 'Entities to document (comma-separated)',
    placeHolder: 'User, Post, Comment',
    validateInput: v => v.trim().length === 0 ? 'Enter at least one entity' : undefined,
  });

  if (!input) return;

  const entities = input.split(',').map(e => e.trim()).filter(Boolean);

  const doc: OpenApiDoc = {
    openapi: '3.0.0',
    info: {
      title: 'Laravel API',
      version,
      description: `Auto-generated OpenAPI specification for ${version}`,
    },
    servers: [
      { url: `http://localhost:8000/api`, description: 'Local development' },
    ],
    paths: {},
    components: { schemas: {} },
  };

  for (const entity of entities) {
    Object.assign(doc.paths, buildPaths(entity, version));
    Object.assign(doc.components.schemas, buildSchemas(entity));
  }

  const outputPath = path.join(workspaceRoot, 'docs', `openapi_${version}.json`);
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf8');

  vscode.window.showInformationMessage(
    `OpenAPI docs generated: docs/openapi_${version}.json`
  );

  const vscodeDoc = await vscode.workspace.openTextDocument(outputPath);
  await vscode.window.showTextDocument(vscodeDoc);
}
