import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export class VscodeHelper {
  static async openInVscode(workspacePath: string): Promise<boolean> {
    try {
      // Check if running in WSL
      if (await this.isWSL()) {
        console.log('Opening in VSCode with WSL remote...');
        const distroName = process.env.WSL_DISTRO_NAME || 'Ubuntu';
        await execAsync(`code --remote wsl+${distroName} "${workspacePath}"`);
        return true;
      }
      
      // Check if running on macOS
      if (process.platform === 'darwin') {
        console.log('Opening in VSCode on macOS...');
        await execAsync(`code "${workspacePath}"`);
        return true;
      }
      
      // Check if running on Linux
      if (process.platform === 'linux') {
        console.log('Opening in VSCode on Linux...');
        await execAsync(`code "${workspacePath}"`);
        return true;
      }
      
      console.log('VSCode not available or unsupported platform');
      return false;
    } catch (error) {
      console.warn(`Could not open VSCode: ${error}`);
      return false;
    }
  }

  static async isVscodeAvailable(): Promise<boolean> {
    try {
      await execAsync('code --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  private static async isWSL(): Promise<boolean> {
    try {
      // Check for WSL-specific files/environment
      if (existsSync('/proc/version')) {
        const { stdout } = await execAsync('cat /proc/version');
        return stdout.toLowerCase().includes('microsoft') || stdout.toLowerCase().includes('wsl');
      }
      
      // Check WSL environment variable
      return process.env.WSL_DISTRO_NAME !== undefined;
    } catch (error) {
      return false;
    }
  }

  static async promptToOpen(workspacePath: string): Promise<void> {
    const isAvailable = await this.isVscodeAvailable();
    
    if (!isAvailable) {
      console.log('VSCode is not available in PATH');
      return;
    }

    console.log(`\nBranch created! You can now work in:`);
    console.log(`  cd ${workspacePath}`);
    console.log(`\nOpening in VSCode...`);
    
    const opened = await this.openInVscode(workspacePath);
    if (!opened) {
      console.log('Failed to open VSCode automatically');
      console.log(`You can manually open: code "${workspacePath}"`);
    }
  }
}