import { createInterface } from 'readline';
import { existsSync, readdirSync } from 'fs';
import path from 'path';

export interface MenuOption {
  label: string;
  value: string;
}

export class MenuHelper {
  private rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  async showMenu(title: string, options: MenuOption[]): Promise<string> {
    return new Promise((resolve) => {
      console.log(`\n${title}`);
      console.log('─'.repeat(title.length));
      
      options.forEach((option, index) => {
        console.log(`${index + 1}. ${option.label}`);
      });
      console.log('0. Cancel');
      
      this.rl.question('\nSelect option (number): ', (answer) => {
        const choice = parseInt(answer.trim());
        
        if (choice === 0) {
          resolve('CANCEL');
        } else if (choice >= 1 && choice <= options.length) {
          resolve(options[choice - 1].value);
        } else {
          console.log('Invalid choice. Please try again.');
          this.showMenu(title, options).then(resolve);
        }
      });
    });
  }

  async prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(`${question}: `, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  async confirm(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(`${question} (y/n): `, (answer) => {
        const response = answer.trim().toLowerCase();
        if (response === 'y' || response === 'yes') {
          resolve(true);
        } else if (response === 'n' || response === 'no') {
          resolve(false);
        } else {
          console.log('Please answer y or n');
          this.confirm(question).then(resolve);
        }
      });
    });
  }


  close(): void {
    this.rl.close();
  }

  // Helper methods for common selections
  async selectRepository(): Promise<string> {
    const repositoriesDir = path.join(process.cwd(), 'repositories');
    
    if (!existsSync(repositoriesDir)) {
      throw new Error('No repositories found. Please clone a repository first.');
    }
    
    const repos = readdirSync(repositoriesDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    if (repos.length === 0) {
      throw new Error('No repositories found. Please clone a repository first.');
    }

    const options: MenuOption[] = repos.map(repo => ({
      label: repo,
      value: repo
    }));

    const result = await this.showMenu('Select Repository', options);
    
    if (result === 'CANCEL') {
      throw new Error('Operation cancelled');
    }
    
    return result;
  }

  async selectWorktree(repositoryName: string): Promise<string> {
    const repoPath = path.join(process.cwd(), 'repositories', repositoryName);
    
    if (!existsSync(repoPath)) {
      throw new Error(`Repository ${repositoryName} not found`);
    }
    
    const branches = readdirSync(repoPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory() && dirent.name !== '.bare')
      .map(dirent => dirent.name);
    
    if (branches.length === 0) {
      throw new Error(`No worktrees found in ${repositoryName}`);
    }

    const options: MenuOption[] = branches.map(branch => ({
      label: branch,
      value: branch
    }));

    const result = await this.showMenu(`Select Worktree from ${repositoryName}`, options);
    
    if (result === 'CANCEL') {
      throw new Error('Operation cancelled');
    }
    
    return result;
  }
}