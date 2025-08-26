import { McpSettings } from '../types/index.js';

/**
 * Data Access Object interface for MCPHub settings persistence
 * This interface abstracts the underlying storage mechanism (file, database, etc.)
 */
export interface SettingsDAO {
  /**
   * Load settings from the persistence layer
   * @returns Promise<McpSettings> The loaded settings
   * @throws Error if loading fails
   */
  loadSettings(): Promise<McpSettings>;

  /**
   * Save settings to the persistence layer
   * @param settings The settings to save
   * @returns Promise<boolean> True if save was successful
   * @throws Error if saving fails
   */
  saveSettings(settings: McpSettings): Promise<boolean>;

  /**
   * Check if settings exist in the persistence layer
   * @returns Promise<boolean> True if settings exist
   */
  exists(): Promise<boolean>;

  /**
   * Clear any cached data and force reload on next access
   */
  clearCache(): void;

  /**
   * Get cache information for debugging
   * @returns Object with cache status information
   */
  getCacheInfo(): { hasCache: boolean; [key: string]: any };

  /**
   * Initialize the DAO (create directories, check permissions, etc.)
   * @returns Promise<void>
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;
}

/**
 * Factory interface for creating DAO instances
 */
export interface DAOFactory {
  /**
   * Create a SettingsDAO instance based on configuration
   * @returns Promise<SettingsDAO> The created DAO instance
   */
  createSettingsDAO(): Promise<SettingsDAO>;
}

/**
 * Configuration for DAO implementations
 */
export interface DAOConfig {
  type: 'file' | 'database' | 'memory';
  config?: Record<string, any>;
}