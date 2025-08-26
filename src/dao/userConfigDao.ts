import { IUser, UserConfig, McpSettings } from '../types/index.js';
import { FileBasedDao } from './base.js';
import { loadOriginalSettings, saveSettings } from '../config/index.js';

/**
 * DAO for managing user-specific configuration data
 */
export class UserConfigDao extends FileBasedDao<UserConfig, string> {
  protected getDataFromSettings(): Record<string, UserConfig> {
    const settings = loadOriginalSettings();
    return settings.userConfigs || {};
  }

  protected async saveDataToSettings(data: Record<string, UserConfig>): Promise<boolean> {
    const settings = loadOriginalSettings();
    const updatedSettings: McpSettings = {
      ...settings,
      userConfigs: data,
    };
    return saveSettings(updatedSettings);
  }

  protected extractKey(_item: UserConfig & { username?: string }): string {
    // For user configs, we need to pass the username separately since UserConfig doesn't contain it
    // This will be handled by overriding the create method
    throw new Error('extractKey should not be called directly for UserConfigDao. Use createForUser instead.');
  }

  protected filterByUser(items: UserConfig[], _user?: IUser): UserConfig[] {
    // This method is not used since we override findAll to work with the Record structure
    return items;
  }

  protected canCreate(item: UserConfig, user?: IUser): boolean {
    // Admin users can create config for any user
    // Non-admin users can only create their own config
    return user?.isAdmin === true || user !== undefined;
  }

  protected canUpdate(key: string, itemUpdates: Partial<UserConfig>, user?: IUser): boolean {
    // Admin users can update any user's config
    if (user?.isAdmin === true) {
      return true;
    }
    
    // Non-admin users can only update their own config
    return user?.username === key;
  }

  protected canDelete(key: string, user?: IUser): boolean {
    // Admin users can delete any user's config
    if (user?.isAdmin === true) {
      return true;
    }
    
    // Non-admin users can only delete their own config
    return user?.username === key;
  }

  protected canAccess(key: string, user?: IUser): boolean {
    // Admin users can access any user's config
    if (user?.isAdmin === true) {
      return true;
    }
    
    // Non-admin users can only access their own config
    return user?.username === key;
  }

  /**
   * Override findAll to handle Record structure and user filtering
   */
  async findAll(user?: IUser): Promise<UserConfig[]> {
    const data = this.getDataFromSettings();
    const configs: UserConfig[] = [];
    
    for (const [username, config] of Object.entries(data)) {
      if (this.canAccess(username, user)) {
        configs.push(config);
      }
    }
    
    return configs;
  }

  /**
   * Create user configuration for a specific user
   */
  async createForUser(username: string, config: UserConfig, user?: IUser): Promise<UserConfig> {
    if (!this.canCreate(config, user)) {
      throw new Error('Permission denied: Cannot create user configuration');
    }

    // Additional check for non-admin users creating config for others
    if (user?.isAdmin !== true && user?.username !== username) {
      throw new Error('Permission denied: Cannot create configuration for other users');
    }

    const data = this.getDataFromSettings();
    
    if (data[username]) {
      throw new Error(`User configuration for ${username} already exists`);
    }

    data[username] = config;
    
    const saved = await this.saveDataToSettings(data);
    if (!saved) {
      throw new Error('Failed to save user configuration');
    }

    return config;
  }

  /**
   * Override create method to require username parameter
   */
  async create(_item: UserConfig, _user?: IUser): Promise<UserConfig> {
    throw new Error('Use createForUser method for UserConfigDao instead of create');
  }

  /**
   * Get user configuration by username
   */
  async getUserConfig(username: string, user?: IUser): Promise<UserConfig | null> {
    return this.findByKey(username, user);
  }

  /**
   * Update user configuration
   */
  async updateUserConfig(username: string, config: Partial<UserConfig>, user?: IUser): Promise<UserConfig | null> {
    return this.update(username, config, user);
  }

  /**
   * Delete user configuration
   */
  async deleteUserConfig(username: string, user?: IUser): Promise<boolean> {
    return this.delete(username, user);
  }

  /**
   * Update routing configuration for a user
   */
  async updateUserRoutingConfig(username: string, routingConfig: Partial<UserConfig['routing']>, user?: IUser): Promise<UserConfig | null> {
    const current = await this.getUserConfig(username, user);
    const currentRouting = current?.routing || {};
    
    return this.update(username, {
      routing: { ...currentRouting, ...routingConfig }
    }, user);
  }

  /**
   * Get all user configurations (admin only)
   */
  async getAllUserConfigs(user?: IUser): Promise<Record<string, UserConfig>> {
    if (user?.isAdmin !== true) {
      throw new Error('Permission denied: Only admin users can get all user configurations');
    }
    
    return this.getDataFromSettings();
  }

  /**
   * Check if user configuration exists
   */
  async userConfigExists(username: string): Promise<boolean> {
    const data = this.getDataFromSettings();
    return username in data;
  }

  /**
   * Set or update user configuration (create if not exists, update if exists)
   */
  async setUserConfig(username: string, config: UserConfig, user?: IUser): Promise<UserConfig> {
    const existing = await this.getUserConfig(username, user);
    
    if (existing) {
      const updated = await this.updateUserConfig(username, config, user);
      if (!updated) {
        throw new Error('Failed to update user configuration');
      }
      return updated;
    } else {
      return this.createForUser(username, config, user);
    }
  }
}