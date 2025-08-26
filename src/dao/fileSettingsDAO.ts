import fs from 'fs';
import path from 'path';
import { McpSettings } from '../types/index.js';
import { SettingsDAO } from './interfaces.js';
import { getConfigFilePath } from '../utils/path.js';

/**
 * File-based implementation of SettingsDAO
 * Handles persistence to JSON files on the filesystem
 */
export class FileSettingsDAO implements SettingsDAO {
  private settingsCache: McpSettings | null = null;
  private readonly settingsPath: string;
  private readonly defaultSettings: McpSettings = { mcpServers: {}, users: [] };

  constructor(filePath?: string) {
    this.settingsPath = filePath || this.getDefaultSettingsPath();
  }

  private getDefaultSettingsPath(): string {
    return getConfigFilePath('mcp_settings.json', 'Settings');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure the directory exists
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create default settings file only if it doesn't exist at all
      if (!await this.exists()) {
        await this.saveSettings(this.defaultSettings);
      }
      // Note: We don't auto-fix corrupted files here - let loadSettings handle that
    } catch (error) {
      throw new Error(`Failed to initialize FileSettingsDAO: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async exists(): Promise<boolean> {
    try {
      await fs.promises.access(this.settingsPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async loadSettings(): Promise<McpSettings> {
    // Return cached data if available
    if (this.settingsCache) {
      return this.settingsCache;
    }

    try {
      const settingsData = await fs.promises.readFile(this.settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);

      // Validate settings structure
      if (!this.isValidSettings(settings)) {
        console.warn(`Invalid settings structure in ${this.settingsPath}, using defaults`);
        return this.getDefaultSettingsWithCache();
      }

      // Update cache
      this.settingsCache = settings;

      console.log(`Loaded settings from ${this.settingsPath}`);
      return settings;
    } catch (error) {
      console.error(`Failed to load settings from ${this.settingsPath}:`, error);
      return this.getDefaultSettingsWithCache();
    }
  }

  async saveSettings(settings: McpSettings): Promise<boolean> {
    try {
      // Validate settings before saving
      if (!this.isValidSettings(settings)) {
        throw new Error('Invalid settings structure');
      }

      // Ensure directory exists
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write settings to file
      await fs.promises.writeFile(
        this.settingsPath,
        JSON.stringify(settings, null, 2),
        'utf8'
      );

      // Update cache after successful save
      this.settingsCache = settings;

      console.log(`Settings saved to ${this.settingsPath}`);
      return true;
    } catch (error) {
      console.error(`Failed to save settings to ${this.settingsPath}:`, error);
      return false;
    }
  }

  clearCache(): void {
    this.settingsCache = null;
  }

  getCacheInfo(): { hasCache: boolean; filePath: string } {
    return {
      hasCache: this.settingsCache !== null,
      filePath: this.settingsPath,
    };
  }

  private getDefaultSettingsWithCache(): McpSettings {
    // Cache default settings
    this.settingsCache = this.defaultSettings;
    return this.defaultSettings;
  }

  private isValidSettings(settings: any): settings is McpSettings {
    return (
      settings &&
      typeof settings === 'object' &&
      typeof settings.mcpServers === 'object' &&
      Array.isArray(settings.users)
    );
  }

  /**
   * Get the file path for debugging purposes
   */
  getFilePath(): string {
    return this.settingsPath;
  }
}