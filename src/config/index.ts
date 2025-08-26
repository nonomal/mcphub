import dotenv from 'dotenv';
import fs from 'fs';
import { McpSettings, IUser } from '../types/index.js';
import { getConfigFilePath } from '../utils/path.js';
import { getPackageVersion } from '../utils/version.js';
import { getDataService } from '../services/services.js';
import { DataService } from '../services/dataService.js';
import { getDAOFactory, type SettingsDAO } from '../dao/index.js';

dotenv.config();

const defaultConfig = {
  port: process.env.PORT || 3000,
  initTimeout: process.env.INIT_TIMEOUT || 300000,
  basePath: process.env.BASE_PATH || '',
  readonly: 'true' === process.env.READONLY || false,
  mcpHubName: 'mcphub',
  mcpHubVersion: getPackageVersion(),
};

const dataService: DataService = getDataService();

// DAO instance for settings persistence
let settingsDAO: SettingsDAO | null = null;

// Settings cache (for backward compatibility and performance)
let settingsCache: McpSettings | null = null;

/**
 * Get or create the settings DAO instance
 */
const getSettingsDAO = async (): Promise<SettingsDAO> => {
  if (!settingsDAO) {
    const factory = getDAOFactory();
    settingsDAO = await factory.createSettingsDAO();
  }
  return settingsDAO;
};

export const getSettingsPath = (): string => {
  return getConfigFilePath('mcp_settings.json', 'Settings');
};

export const loadOriginalSettings = async (): Promise<McpSettings> => {
  try {
    const dao = await getSettingsDAO();
    const settings = await dao.loadSettings();
    
    // Update local cache for backward compatibility
    settingsCache = settings;
    
    return settings;
  } catch (error) {
    console.error('Failed to load settings via DAO:', error);
    // Fallback to default settings
    const defaultSettings = { mcpServers: {}, users: [] };
    settingsCache = defaultSettings;
    return defaultSettings;
  }
};

/**
 * Synchronous version for backward compatibility
 * @deprecated Use loadOriginalSettings() (async version) instead
 */
export const loadOriginalSettingsSync = (): McpSettings => {
  // If cache exists, return cached data directly
  if (settingsCache) {
    return settingsCache;
  }

  // Fallback to direct file reading for sync compatibility
  const settingsPath = getSettingsPath();
  try {
    const settingsData = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);

    // Update cache
    settingsCache = settings;

    console.log(`Loaded settings from ${settingsPath}`);
    return settings;
  } catch (error) {
    console.error(`Failed to load settings from ${settingsPath}:`, error);
    const defaultSettings = { mcpServers: {}, users: [] };

    // Cache default settings
    settingsCache = defaultSettings;

    return defaultSettings;
  }
};

export const loadSettings = (user?: IUser): McpSettings => {
  return dataService.filterSettings!(loadOriginalSettingsSync(), user);
};

export const saveSettings = (settings: McpSettings, user?: IUser): boolean => {
  return saveSettingsSync(settings, user);
};

export const clearSettingsCache = (): void => {
  clearSettingsCacheSync();
};

export const getSettingsCacheInfo = (): { hasCache: boolean } => {
  return getSettingsCacheInfoSync();
};

// Async versions for new code that can handle promises
export const loadSettingsAsync = async (user?: IUser): Promise<McpSettings> => {
  const settings = await loadOriginalSettings();
  return dataService.filterSettings!(settings, user);
};

export const saveSettingsAsync = async (settings: McpSettings, user?: IUser): Promise<boolean> => {
  try {
    const dao = await getSettingsDAO();
    const mergedSettings = dataService.mergeSettings!(await loadOriginalSettings(), settings, user);
    const success = await dao.saveSettings(mergedSettings);
    
    if (success) {
      // Update cache after successful save
      settingsCache = mergedSettings;
    }
    
    return success;
  } catch (error) {
    console.error('Failed to save settings via DAO:', error);
    return false;
  }
};

/**
 * Synchronous version for backward compatibility
 * @deprecated Use saveSettings() (async version) instead
 */
export const saveSettingsSync = (settings: McpSettings, user?: IUser): boolean => {
  const settingsPath = getSettingsPath();
  try {
    const mergedSettings = dataService.mergeSettings!(loadOriginalSettingsSync(), settings, user);
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2), 'utf8');

    // Update cache after successful save
    settingsCache = mergedSettings;

    return true;
  } catch (error) {
    console.error(`Failed to save settings to ${settingsPath}:`, error);
    return false;
  }
};

/**
 * Clear settings cache, force next loadSettings call to re-read from storage
 */
export const clearSettingsCacheAsync = async (): Promise<void> => {
  settingsCache = null;
  
  try {
    const dao = await getSettingsDAO();
    dao.clearCache();
  } catch (error) {
    console.error('Failed to clear DAO cache:', error);
  }
};

/**
 * Synchronous version for backward compatibility
 * @deprecated Use clearSettingsCache() (async version) instead
 */
export const clearSettingsCacheSync = (): void => {
  settingsCache = null;
};

/**
 * Get current cache status (for debugging)
 */
export const getSettingsCacheInfoAsync = async (): Promise<{ hasCache: boolean; daoInfo?: any }> => {
  const result = {
    hasCache: settingsCache !== null,
    daoInfo: undefined as any,
  };
  
  try {
    const dao = await getSettingsDAO();
    result.daoInfo = dao.getCacheInfo();
  } catch (error) {
    console.error('Failed to get DAO cache info:', error);
  }
  
  return result;
};

/**
 * Synchronous version for backward compatibility
 * @deprecated Use getSettingsCacheInfo() (async version) instead
 */
export const getSettingsCacheInfoSync = (): { hasCache: boolean } => {
  return {
    hasCache: settingsCache !== null,
  };
};

export function replaceEnvVars(input: Record<string, any>): Record<string, any>;
export function replaceEnvVars(input: string[] | undefined): string[];
export function replaceEnvVars(input: string): string;
export function replaceEnvVars(
  input: Record<string, any> | string[] | string | undefined,
): Record<string, any> | string[] | string {
  // Handle object input
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    const res: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        res[key] = expandEnvVars(value);
      } else {
        res[key] = String(value);
      }
    }
    return res;
  }

  // Handle array input
  if (Array.isArray(input)) {
    return input.map((item) => expandEnvVars(item));
  }

  // Handle string input
  if (typeof input === 'string') {
    return expandEnvVars(input);
  }

  // Handle undefined/null array input
  if (input === undefined || input === null) {
    return [];
  }

  return input;
}

export const expandEnvVars = (value: string): string => {
  if (typeof value !== 'string') {
    return String(value);
  }
  // Replace ${VAR} format
  let result = value.replace(/\$\{([^}]+)\}/g, (_, key) => process.env[key] || '');
  // Also replace $VAR format (common on Unix-like systems)
  result = result.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, key) => process.env[key] || '');
  return result;
};

export default defaultConfig;
