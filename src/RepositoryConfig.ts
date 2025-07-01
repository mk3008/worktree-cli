import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

export interface RepositoryConfig {
  defaultBranch: string;
  repositoryUrl: string;
}

export class RepositoryConfigManager {
  private configPath: string;

  constructor(repositoryPath: string) {
    this.configPath = path.join(repositoryPath, '.worktree.json');
  }

  save(config: RepositoryConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  load(): RepositoryConfig | null {
    if (!existsSync(this.configPath)) {
      return null;
    }

    try {
      const data = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error reading repository config: ${error}`);
      return null;
    }
  }

  getDefaultBranch(): string | null {
    const config = this.load();
    return config?.defaultBranch || null;
  }
}