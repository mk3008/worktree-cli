import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync } from 'fs';
import path from 'path';
import { RepositoryConfigManager, RepositoryConfig } from './RepositoryConfig.js';

const execAsync = promisify(exec);

export interface WorktreeConfig {
  baseDir: string;
  repositoryName: string;
  defaultBranch?: string;
}

export class WorktreeManager {
  private baseDir: string;
  private repositoryName: string;
  private repositoryPath: string;
  private barePath: string;
  private defaultBranch: string;
  private configManager: RepositoryConfigManager;

  constructor(config: WorktreeConfig) {
    this.baseDir = config.baseDir;
    this.repositoryName = config.repositoryName;
    this.repositoryPath = path.join(this.baseDir, this.repositoryName);
    this.barePath = path.join(this.repositoryPath, '.bare');
    this.defaultBranch = config.defaultBranch || 'main';
    this.configManager = new RepositoryConfigManager(this.repositoryPath);
  }

  async clone(repositoryUrl: string): Promise<void> {
    try {
      if (!existsSync(this.baseDir)) {
        mkdirSync(this.baseDir, { recursive: true });
      }

      if (existsSync(this.repositoryPath)) {
        throw new Error(`Repository directory already exists: ${this.repositoryPath}`);
      }

      mkdirSync(this.repositoryPath, { recursive: true });

      console.log(`Cloning repository to ${this.barePath}...`);
      await execAsync(`git clone --bare ${repositoryUrl} ${this.barePath}`);

      // Detect the actual default branch from the remote
      let actualDefaultBranch: string;
      try {
        // First, set the remote HEAD to track the default branch
        await execAsync(`cd "${this.barePath}" && git remote set-head origin -a`);
        const defaultBranchCmd = await execAsync(`cd "${this.barePath}" && git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`);
        actualDefaultBranch = defaultBranchCmd.stdout.trim();
      } catch (error) {
        // Fallback: use 'main' or 'master' based on what exists
        try {
          const branchesCmd = await execAsync(`cd "${this.barePath}" && git branch -r`);
          const branches = branchesCmd.stdout;
          if (branches.includes('origin/main')) {
            actualDefaultBranch = 'main';
          } else if (branches.includes('origin/master')) {
            actualDefaultBranch = 'master';
          } else {
            actualDefaultBranch = this.defaultBranch;
          }
        } catch (fallbackError) {
          actualDefaultBranch = this.defaultBranch;
        }
      }
      
      this.defaultBranch = actualDefaultBranch;
      
      // Save repository configuration
      const repoConfig: RepositoryConfig = {
        defaultBranch: actualDefaultBranch,
        repositoryUrl
      };
      this.configManager.save(repoConfig);

      const worktreePath = path.join(this.repositoryPath, actualDefaultBranch);
      console.log(`Creating worktree for default branch ${actualDefaultBranch}...`);
      await execAsync(`cd "${this.barePath}" && git worktree add "${worktreePath}" ${actualDefaultBranch}`);


      console.log(`Repository cloned successfully!`);
      console.log(`Bare repository: ${this.barePath}`);
      console.log(`Default branch worktree: ${worktreePath}`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error}`);
    }
  }

  async createBranch(branchName: string, baseBranch?: string, pullLatest: boolean = false): Promise<void> {
    try {
      if (!existsSync(this.barePath)) {
        throw new Error(`Repository not found. Please clone first.`);
      }

      const worktreePath = path.join(this.repositoryPath, branchName);
      
      if (existsSync(worktreePath)) {
        throw new Error(`Worktree for branch ${branchName} already exists`);
      }

      // Use saved default branch if no base branch specified
      const savedDefaultBranch = this.configManager.getDefaultBranch();
      const base = baseBranch || savedDefaultBranch || this.defaultBranch;
      
      if (pullLatest) {
        console.log(`Fetching latest changes...`);
        try {
          await execAsync(`cd "${this.barePath}" && git fetch origin`);
          console.log(`✅ Latest changes fetched`);
        } catch (error) {
          console.warn(`⚠️  Warning: Could not fetch latest changes: ${error}`);
        }
      }
      
      console.log(`Creating new branch ${branchName} from origin/${base}...`);
      
      // First ensure we have the remote reference, then create worktree
      await execAsync(`cd "${this.barePath}" && git fetch origin ${base}:refs/remotes/origin/${base}`);
      await execAsync(`cd "${this.barePath}" && git worktree add -b ${branchName} "${worktreePath}" origin/${base}`);
      
      console.log(`Branch ${branchName} created successfully at ${worktreePath}`);
    } catch (error) {
      throw new Error(`Failed to create branch: ${error}`);
    }
  }

  async listWorktrees(): Promise<string[]> {
    try {
      if (!existsSync(this.barePath)) {
        throw new Error(`Repository not found. Please clone first.`);
      }

      const result = await execAsync(`cd "${this.barePath}" && git worktree list --porcelain`);
      const lines = result.stdout.split('\n');
      const worktrees: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('worktree ')) {
          const path = lines[i].substring(9);
          const branchLine = lines[i + 2];
          const branch = branchLine ? branchLine.replace('branch refs/heads/', '') : 'detached';
          worktrees.push(`${path} (${branch})`);
        }
      }
      
      return worktrees;
    } catch (error) {
      throw new Error(`Failed to list worktrees: ${error}`);
    }
  }

  async removeWorktree(branchName: string, force: boolean = false): Promise<void> {
    try {
      if (!existsSync(this.barePath)) {
        throw new Error(`Repository not found.`);
      }

      const worktreePath = path.join(this.repositoryPath, branchName);
      
      console.log(`Removing worktree for ${branchName}...`);
      
      const forceFlag = force ? '--force' : '';
      const command = `cd "${this.barePath}" && git worktree remove ${forceFlag} "${worktreePath}"`;
      
      await execAsync(command);
      
      console.log(`Worktree ${branchName} removed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!force && errorMessage.includes('contains modified or untracked files')) {
        throw new Error(`Worktree contains modified or untracked files. Use 'npm run remove:force ${this.repositoryName} ${branchName}' to force removal.`);
      }
      throw new Error(`Failed to remove worktree: ${error}`);
    }
  }

  async listRemoteBranches(): Promise<string[]> {
    try {
      if (!existsSync(this.barePath)) {
        throw new Error(`Repository not found. Please clone first.`);
      }

      // Fetch latest changes including all refs
      console.log(`Fetching latest changes...`);
      await execAsync(`cd "${this.barePath}" && git fetch --prune origin "+refs/heads/*:refs/remotes/origin/*"`);

      // Get all remote branches using a simpler approach
      const result = await execAsync(`cd "${this.barePath}" && git ls-remote --heads origin`);
      const branches = result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Each line format: <sha> refs/heads/<branch-name>
          const match = line.match(/refs\/heads\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter((branch): branch is string => branch !== null);

      return [...new Set(branches)].sort(); // Remove duplicates and sort
    } catch (error) {
      throw new Error(`Failed to list remote branches: ${error}`);
    }
  }

  async openRemoteBranch(branchName: string): Promise<void> {
    try {
      if (!existsSync(this.barePath)) {
        throw new Error(`Repository not found. Please clone first.`);
      }

      const worktreePath = path.join(this.repositoryPath, branchName);
      
      // Check if worktree already exists
      if (existsSync(worktreePath)) {
        console.log(`Worktree for branch ${branchName} already exists at ${worktreePath}`);
        return;
      }

      // Fetch latest changes including all refs
      console.log(`Fetching latest changes...`);
      await execAsync(`cd "${this.barePath}" && git fetch origin "+refs/heads/*:refs/remotes/origin/*"`);

      // Check if the remote branch exists
      const remoteBranches = await this.listRemoteBranches();
      if (!remoteBranches.includes(branchName)) {
        console.log(`Available remote branches:`);
        remoteBranches.forEach(branch => console.log(`  - ${branch}`));
        throw new Error(`Remote branch '${branchName}' not found. Please check the branch name.`);
      }

      // Create worktree tracking the remote branch
      console.log(`Creating worktree for remote branch ${branchName}...`);
      try {
        // First try to create with the same local branch name
        await execAsync(`cd "${this.barePath}" && git worktree add "${worktreePath}" -b ${branchName} origin/${branchName}`);
      } catch (error) {
        // If branch already exists locally, just track the remote
        console.log(`Local branch ${branchName} already exists, creating worktree...`);
        await execAsync(`cd "${this.barePath}" && git worktree add "${worktreePath}" ${branchName}`);
      }
      
      console.log(`Remote branch ${branchName} opened successfully at ${worktreePath}`);
    } catch (error) {
      throw new Error(`Failed to open remote branch: ${error}`);
    }
  }
}