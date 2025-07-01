#!/usr/bin/env node
import { WorktreeManager } from './WorktreeManager.js';
import { VscodeHelper } from './VscodeHelper.js';
import path from 'path';
import { existsSync, readdirSync } from 'fs';

const args = process.argv.slice(2);
const command = args[0];

function parseRepoUrl(url: string): { repositoryName: string } {
  const match = url.match(/\/([^\/]+?)(\.git)?$/);
  if (!match) {
    throw new Error('Invalid repository URL');
  }
  return { repositoryName: match[1] };
}

function getManager(repositoryName: string): WorktreeManager {
  const projectRoot = process.cwd();
  const baseDir = path.join(projectRoot, 'repositories');
  
  return new WorktreeManager({
    baseDir,
    repositoryName
  });
}

function listAllRepositories(): void {
  const repositoriesDir = path.join(process.cwd(), 'repositories');
  
  if (!existsSync(repositoriesDir)) {
    console.log('No repositories found.');
    return;
  }
  
  const repos = readdirSync(repositoriesDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  if (repos.length === 0) {
    console.log('No repositories found.');
    return;
  }
  
  console.log('Available repositories:');
  repos.forEach(repo => {
    console.log(`  - ${repo}`);
  });
}

async function main() {
  try {
    switch (command) {
      case 'clone': {
        const url = args[1];
        if (!url) {
          console.error('Usage: npm run clone <repository-url>');
          process.exit(1);
        }
        
        const { repositoryName } = parseRepoUrl(url);
        const manager = getManager(repositoryName);
        await manager.clone(url);
        
        console.log(`\\nNext steps:`);
        console.log(`  npm run branch ${repositoryName} <branch-name>     # Create new branch`);
        console.log(`  npm run list ${repositoryName}                    # List worktrees`);
        break;
      }
      
      case 'branch':
      case 'create': {
        const repositoryName = args[1];
        const branchName = args[2];
        const baseBranch = args[3];
        
        if (!repositoryName || !branchName) {
          console.error('Usage: npm run branch <repository-name> <branch-name> [base-branch]');
          console.error('       npm run branch:vscode <repository-name> <branch-name> [base-branch]');
          console.error('Example: npm run branch rawsql-ts feature1');
          console.error('Example: npm run branch:vscode rawsql-ts feature1  # Open in VSCode');
          process.exit(1);
        }
        
        const manager = getManager(repositoryName);
        await manager.createBranch(branchName, baseBranch);
        
        const workspacePath = path.join('repositories', repositoryName, branchName);
        console.log(`\\nBranch created! You can now work in:`);
        console.log(`  cd ${workspacePath}`);
        console.log(`\\nTip: Use 'npm run branch:vscode' to automatically open in VSCode`);
        break;
      }
      
      case 'branch-vscode': {
        const repositoryName = args[1];
        const branchName = args[2];
        const baseBranch = args[3];
        
        if (!repositoryName || !branchName) {
          console.error('Usage: npm run branch:vscode <repository-name> <branch-name> [base-branch]');
          console.error('Example: npm run branch:vscode rawsql-ts feature1');
          process.exit(1);
        }
        
        const manager = getManager(repositoryName);
        await manager.createBranch(branchName, baseBranch);
        
        const workspacePath = path.join('repositories', repositoryName, branchName);
        await VscodeHelper.promptToOpen(workspacePath);
        break;
      }
      
      case 'list': {
        const repositoryName = args[1];
        
        if (!repositoryName) {
          // List all repositories if no specific repo given
          listAllRepositories();
          break;
        }
        
        const manager = getManager(repositoryName);
        const worktrees = await manager.listWorktrees();
        console.log(`Worktrees for ${repositoryName}:`);
        worktrees.forEach(wt => console.log(`  ${wt}`));
        break;
      }
      
      case 'remove': {
        const repositoryName = args[1];
        const branchName = args[2];
        
        if (!repositoryName || !branchName) {
          console.error('Usage: npm run remove <repository-name> <branch-name>');
          console.error('       npm run remove:force <repository-name> <branch-name>');
          console.error('Example: npm run remove rawsql-ts feature1');
          process.exit(1);
        }
        
        const manager = getManager(repositoryName);
        await manager.removeWorktree(branchName, false);
        break;
      }
      
      case 'remove-force': {
        const repositoryName = args[1];
        const branchName = args[2];
        
        if (!repositoryName || !branchName) {
          console.error('Usage: npm run remove:force <repository-name> <branch-name>');
          console.error('Example: npm run remove:force rawsql-ts feature1');
          process.exit(1);
        }
        
        console.log(`⚠️  Force removing worktree (this will discard any unsaved changes)`);
        const manager = getManager(repositoryName);
        await manager.removeWorktree(branchName, true);
        break;
      }
      
      default:
        console.log('Git Worktree Manager');
        console.log('');
        console.log('Commands:');
        console.log('  npm run clone <repository-url>                       - Clone a repository');
        console.log('  npm run branch <repo-name> <branch-name> [base]      - Create a new branch');
        console.log('  npm run branch:vscode <repo-name> <branch-name>      - Create branch & open in VSCode');
        console.log('  npm run list [repo-name]                             - List worktrees (or all repos)');
        console.log('  npm run remove <repo-name> <branch-name>             - Remove a worktree');
        console.log('  npm run remove:force <repo-name> <branch-name>       - Force remove (discard changes)');
        console.log('');
        console.log('Examples:');
        console.log('  npm run clone https://github.com/mk3008/rawsql-ts.git');
        console.log('  npm run branch rawsql-ts feature1');
        console.log('  npm run branch rawsql-ts feature2 develop');
        console.log('  npm run branch:vscode rawsql-ts feature3      # Open in VSCode');
        console.log('  npm run list rawsql-ts');
        console.log('  npm run list');
        console.log('  npm run remove rawsql-ts feature1');
        console.log('  npm run remove:force rawsql-ts feature1       # Force remove');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();