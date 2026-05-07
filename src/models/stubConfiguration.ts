export type MergeStrategy = 'backup' | 'skip' | 'replace' | 'append';

export interface FeatureConfig {
  enabled: boolean;
  /** When true, uses customStubPath. When false, uses extension's built-in stubs. */
  useCustomStub: boolean;
  /** Custom stub file path. Only used when useCustomStub is true. */
  customStubPath: string;
  /** Custom base path for generated files (e.g., 'app/Http/Controllers/Api') */
  customBasePath: string;
  /** Custom base namespace (e.g., 'App\\Http\\Controllers\\Api') */
  customBaseNamespace: string;
}

export interface StubConfig {
  features: {
    model: FeatureConfig;
    migration: FeatureConfig;
    controller: FeatureConfig;
    repository: FeatureConfig;
    policy: FeatureConfig;
    resource: FeatureConfig;
    dto: FeatureConfig;
    store_validation: FeatureConfig;
    update_validation: FeatureConfig;
  };
  route: {
    enabled: boolean;
    file: string;
  };
  defaultVersion: string;
  useVersion: boolean;
  mergeStrategy: MergeStrategy;
  autoCommit: boolean;
  autoOpenFiles: boolean;
}

export interface PresetSchema {
  name: string;
  version: string;
  features: StubConfig['features'];
  route: StubConfig['route'];
  defaultVersion: string;
  useVersion: boolean;
}

export const DEFAULT_CONFIG: StubConfig = {
  features: {
    model:             { enabled: true,  useCustomStub: false, customStubPath: 'stubs/model.stub', customBasePath: 'app/Models', customBaseNamespace: 'App\\Models' },
    migration:         { enabled: true,  useCustomStub: false, customStubPath: 'stubs/migration.stub', customBasePath: 'database/migrations', customBaseNamespace: '' },
    controller:        { enabled: true,  useCustomStub: false, customStubPath: 'stubs/controller.stub', customBasePath: 'app/Http/Controllers/Api', customBaseNamespace: 'App\\Http\\Controllers\\Api' },
    repository:        { enabled: true,  useCustomStub: false, customStubPath: 'stubs/repository.stub', customBasePath: 'app/Http/Repositories', customBaseNamespace: 'App\\Http\\Repositories' },
    policy:            { enabled: true,  useCustomStub: false, customStubPath: 'stubs/policy.stub', customBasePath: 'app/Policies', customBaseNamespace: 'App\\Policies' },
    resource:          { enabled: true,  useCustomStub: false, customStubPath: 'stubs/resource.stub', customBasePath: 'app/Http/Resources', customBaseNamespace: 'App\\Http\\Resources' },
    dto:               { enabled: true,  useCustomStub: false, customStubPath: 'stubs/dto.stub', customBasePath: 'app/Http/Dtos', customBaseNamespace: 'App\\Http\\Dtos' },
    store_validation:  { enabled: true,  useCustomStub: false, customStubPath: 'stubs/store_validation.stub', customBasePath: 'app/Http/Requests', customBaseNamespace: 'App\\Http\\Requests' },
    update_validation: { enabled: true,  useCustomStub: false, customStubPath: 'stubs/update_validation.stub', customBasePath: 'app/Http/Requests', customBaseNamespace: 'App\\Http\\Requests' },
  },
  route: {
    enabled: true,
    file: 'api.php',
  },
  defaultVersion: 'v1',
  useVersion: true,
  mergeStrategy: 'backup',
  autoCommit: false,
  autoOpenFiles: false,
};
