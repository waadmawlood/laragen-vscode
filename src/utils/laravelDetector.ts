import * as fs from 'fs';
import * as path from 'path';

export interface LaravelInfo {
  version: string;
  majorVersion: number;
  detected: boolean;
}

export function detectLaravelVersion(workspaceRoot: string): LaravelInfo {
  const composerPath = path.join(workspaceRoot, 'composer.json');

  if (!fs.existsSync(composerPath)) {
    return { version: '11.*', majorVersion: 11, detected: false };
  }

  try {
    const raw = fs.readFileSync(composerPath, 'utf8');
    const composer = JSON.parse(raw);
    const require = composer.require ?? {};
    const versionStr: string = require['laravel/framework'] ?? require['laravel/laravel'] ?? '11.*';

    // Strip ^ ~ * chars and get major
    const cleaned = versionStr.replace(/[\^~*]/g, '').trim();
    const major = parseInt(cleaned.split('.')[0], 10);

    return {
      version: versionStr,
      majorVersion: isNaN(major) ? 11 : major,
      detected: true,
    };
  } catch {
    return { version: '11.*', majorVersion: 11, detected: false };
  }
}
