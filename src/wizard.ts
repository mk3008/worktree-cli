#!/usr/bin/env node
import { MenuHelper, MenuOption } from './MenuHelper.js';
import { WorktreeManager } from './WorktreeManager.js';
import { VscodeHelper } from './VscodeHelper.js';
import { RepositoryConfigManager } from './RepositoryConfig.js';
import path from 'path';

// Constants
const MENU_CONFIG = {
  clone: { icon: '🚀', title: 'Clone Repository', name: 'Clone Repository' },
  branch: { icon: '🌿', title: 'Create New Branch', name: 'Create New Branch' },
  list: { icon: '📋', title: 'List Worktrees', name: 'List Worktrees' },
  remove: { icon: '❌', title: 'Remove Worktree', name: 'Remove Worktree' },
  help: { icon: '❓', title: 'Show CLI Help', name: 'CLI Help' }
} as const;

const CLI_COMMANDS = [
  'npm run clone <repository-url>',
  'npm run branch <repo-name> <branch-name> [base]',
  'npm run branch:vscode <repo-name> <branch-name>',
  'npm run list [repo-name]',
  'npm run remove <repo-name> <branch-name>',
  'npm run remove:force <repo-name> <branch-name>'
];

// Types
type WizardOperation = (menu: MenuHelper) => Promise<boolean>;
type OperationKey = keyof typeof MENU_CONFIG;

// Utility functions
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

function isOperationCancelled(error: unknown): boolean {
  return error?.toString().includes('Operation cancelled') || false;
}

function printSectionHeader(config: typeof MENU_CONFIG[OperationKey]): void {
  console.log(`\n${config.icon} ${config.title}`);
  console.log('━'.repeat(50));
}

// Common error handling wrapper
async function withErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<boolean> {
  try {
    await operation();
    return true;
  } catch (error) {
    if (isOperationCancelled(error)) {
      return false; // Return to main menu
    }
    console.error(`❌ Error: ${error}`);
    return true; // Continue same operation
  }
}

// Wizard operations
const cloneRepositoryWizard: WizardOperation = async (menu) => {
  printSectionHeader(MENU_CONFIG.clone);
  
  return withErrorHandling(async () => {
    const url = await menu.prompt('Enter repository URL');
    if (!url) {
      console.log('❌ Repository URL is required');
      return;
    }
    
    const { repositoryName } = parseRepoUrl(url);
    const manager = getManager(repositoryName);
    
    console.log(`\n📥 Cloning ${repositoryName}...`);
    await manager.clone(url);
    
    console.log(`✅ Repository cloned successfully!`);
  }, 'Clone Repository');
};

const createBranchWizard: WizardOperation = async (menu) => {
  printSectionHeader(MENU_CONFIG.branch);
  
  return withErrorHandling(async () => {
    const repositoryName = await menu.selectRepository();
    const branchName = await menu.prompt('Enter new branch name');
    
    if (!branchName) {
      console.log('❌ Branch name is required');
      return;
    }
    
    // Get base branch options
    const repoPath = path.join(process.cwd(), 'repositories', repositoryName);
    const configManager = new RepositoryConfigManager(repoPath);
    const defaultBranch = configManager.getDefaultBranch() || 'main';
    
    const options: MenuOption[] = [
      { label: `${defaultBranch} (default)`, value: defaultBranch },
      { label: 'Choose existing branch', value: 'CHOOSE' }
    ];
    
    const baseChoice = await menu.showMenu('Select base branch', options);
    if (baseChoice === 'CANCEL') {
      throw new Error('Operation cancelled');
    }
    
    let baseBranch = baseChoice;
    if (baseChoice === 'CHOOSE') {
      baseBranch = await menu.selectWorktree(repositoryName);
    }
    
    const openVscode = await menu.confirm('Open in VSCode after creation?');
    
    const manager = getManager(repositoryName);
    
    console.log(`\n🚀 Creating branch ${branchName} from ${baseBranch}...`);
    await manager.createBranch(branchName, baseBranch, true);
    
    const workspacePath = path.join('repositories', repositoryName, branchName);
    
    if (openVscode) {
      await VscodeHelper.promptToOpen(workspacePath);
    } else {
      console.log(`✅ Branch created! You can now work in:`);
      console.log(`   cd ${workspacePath}`);
    }
  }, 'Create New Branch');
};

const listWorktreesWizard: WizardOperation = async (menu) => {
  printSectionHeader(MENU_CONFIG.list);
  
  return withErrorHandling(async () => {
    const repositoryName = await menu.selectRepository();
    const manager = getManager(repositoryName);
    
    const worktrees = await manager.listWorktrees();
    console.log(`\n📂 Worktrees for ${repositoryName}:`);
    worktrees.forEach(wt => console.log(`   • ${wt}`));
  }, 'List Worktrees');
};

const removeWorktreeWizard: WizardOperation = async (menu) => {
  printSectionHeader(MENU_CONFIG.remove);
  
  return withErrorHandling(async () => {
    const repositoryName = await menu.selectRepository();
    const branchName = await menu.selectWorktree(repositoryName);
    
    console.log(`\n⚠️  You are about to remove: ${repositoryName}/${branchName}`);
    const confirmed = await menu.confirm('Are you sure?');
    
    if (!confirmed) {
      throw new Error('Operation cancelled');
    }
    
    const manager = getManager(repositoryName);
    
    try {
      console.log(`\n❌ Removing worktree ${branchName}...`);
      await manager.removeWorktree(branchName, false);
      console.log(`✅ Worktree ${branchName} removed successfully`);
    } catch (error) {
      if (error instanceof Error && error.toString().includes('contains modified or untracked files')) {
        console.log(`\n⚠️  Worktree contains unsaved changes.`);
        const forceRemove = await menu.confirm('Force remove (discard changes)?');
        
        if (forceRemove) {
          await manager.removeWorktree(branchName, true);
          console.log(`✅ Worktree ${branchName} forcefully removed`);
        } else {
          throw new Error('Operation cancelled');
        }
      } else {
        throw error;
      }
    }
  }, 'Remove Worktree');
};

const showHelpWizard: WizardOperation = async () => {
  console.log('\n📖 CLI Commands:');
  CLI_COMMANDS.forEach(cmd => console.log(`   ${cmd}`));
  return true; // Always continue to menu
};

// Operation registry
const OPERATIONS: Record<string, WizardOperation> = {
  clone: cloneRepositoryWizard,
  branch: createBranchWizard,
  list: listWorktreesWizard,
  remove: removeWorktreeWizard,
  help: showHelpWizard
};

// Main wizard loop
async function runWizardLoop(menu: MenuHelper, operationKey: string): Promise<void> {
  const operation = OPERATIONS[operationKey];
  if (!operation) return;
  
  while (true) {
    const shouldContinue = await operation(menu);
    if (!shouldContinue) break;
  }
}

async function mainMenu(): Promise<void> {
  const menu = new MenuHelper();
  
  try {
    while (true) {
      const options: MenuOption[] = Object.entries(MENU_CONFIG).map(([key, config]) => ({
        label: `${config.icon} ${config.title}`,
        value: key
      }));
      
      console.log('\n🛠️  Git Worktree Manager - Interactive Mode');
      const choice = await menu.showMenu('What would you like to do?', options);
      
      if (choice === 'CANCEL') {
        console.log('\n👋 Goodbye!');
        break;
      }
      
      await runWizardLoop(menu, choice);
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  } finally {
    menu.close();
  }
}

mainMenu();