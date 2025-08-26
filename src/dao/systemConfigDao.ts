import { IUser, SystemConfig, McpSettings } from '../types/index.js';
import { FileBasedDao } from './base.js';
import { loadOriginalSettings, saveSettings } from '../config/index.js';

/**
 * DAO for managing system configuration data
 * System config is a singleton - there's only one system configuration
 */
export class SystemConfigDao extends FileBasedDao<SystemConfig, 'system'> {
  private static readonly SYSTEM_KEY = 'system';

  protected getDataFromSettings(): Record<string, SystemConfig> {
    const settings = loadOriginalSettings();
    return settings.systemConfig ? { [SystemConfigDao.SYSTEM_KEY]: settings.systemConfig } : {};
  }

  protected async saveDataToSettings(data: Record<string, SystemConfig>): Promise<boolean> {
    const settings = loadOriginalSettings();
    const updatedSettings: McpSettings = {
      ...settings,
      systemConfig: data[SystemConfigDao.SYSTEM_KEY] || undefined,
    };
    return saveSettings(updatedSettings);
  }

  protected extractKey(_item: SystemConfig): 'system' {
    return SystemConfigDao.SYSTEM_KEY;
  }

  protected filterByUser(items: SystemConfig[], user?: IUser): SystemConfig[] {
    // Only admin users can view system configuration
    if (!user || user?.isAdmin === true) {
      return items;
    }
    return [];
  }

  protected canCreate(item: SystemConfig, user?: IUser): boolean {
    // Only admin users can create system configuration
    return user?.isAdmin === true;
  }

  protected canUpdate(key: 'system', itemUpdates: Partial<SystemConfig>, user?: IUser): boolean {
    // Only admin users can update system configuration
    return user?.isAdmin === true;
  }

  protected canDelete(key: 'system', user?: IUser): boolean {
    // Only admin users can delete system configuration
    return user?.isAdmin === true;
  }

  protected canAccess(key: 'system', user?: IUser): boolean {
    // Only admin users can access system configuration
    return user?.isAdmin === true;
  }

  /**
   * Get the system configuration
   */
  async getSystemConfig(user?: IUser): Promise<SystemConfig | null> {
    return this.findByKey(SystemConfigDao.SYSTEM_KEY, user);
  }

  /**
   * Create or update the system configuration
   */
  async setSystemConfig(config: SystemConfig, user?: IUser): Promise<SystemConfig> {
    const existing = await this.getSystemConfig(user);
    
    if (existing) {
      const updated = await this.update(SystemConfigDao.SYSTEM_KEY, config, user);
      if (!updated) {
        throw new Error('Failed to update system configuration');
      }
      return updated;
    } else {
      return this.create(config, user);
    }
  }

  /**
   * Update routing configuration
   */
  async updateRoutingConfig(routingConfig: Partial<SystemConfig['routing']>, user?: IUser): Promise<SystemConfig | null> {
    const current = await this.getSystemConfig(user);
    const currentRouting = current?.routing || {};
    
    return this.update(SystemConfigDao.SYSTEM_KEY, {
      routing: { ...currentRouting, ...routingConfig }
    }, user);
  }

  /**
   * Update install configuration
   */
  async updateInstallConfig(installConfig: Partial<SystemConfig['install']>, user?: IUser): Promise<SystemConfig | null> {
    const current = await this.getSystemConfig(user);
    const currentInstall = current?.install || {};
    
    return this.update(SystemConfigDao.SYSTEM_KEY, {
      install: { ...currentInstall, ...installConfig }
    }, user);
  }

  /**
   * Update smart routing configuration
   */
  async updateSmartRoutingConfig(smartRoutingConfig: Partial<SystemConfig['smartRouting']>, user?: IUser): Promise<SystemConfig | null> {
    const current = await this.getSystemConfig(user);
    const currentSmartRouting = current?.smartRouting || {
      enabled: false,
      dbUrl: '',
      openaiApiBaseUrl: '',
      openaiApiKey: '',
      openaiApiEmbeddingModel: ''
    };
    
    return this.update(SystemConfigDao.SYSTEM_KEY, {
      smartRouting: { ...currentSmartRouting, ...smartRoutingConfig }
    }, user);
  }

  /**
   * Update MCP router configuration
   */
  async updateMcpRouterConfig(mcpRouterConfig: Partial<SystemConfig['mcpRouter']>, user?: IUser): Promise<SystemConfig | null> {
    const current = await this.getSystemConfig(user);
    const currentMcpRouter = current?.mcpRouter || {};
    
    return this.update(SystemConfigDao.SYSTEM_KEY, {
      mcpRouter: { ...currentMcpRouter, ...mcpRouterConfig }
    }, user);
  }

  /**
   * Delete the system configuration
   */
  async deleteSystemConfig(user?: IUser): Promise<boolean> {
    return this.delete(SystemConfigDao.SYSTEM_KEY, user);
  }

  /**
   * Override create method to use the fixed key
   */
  async create(item: SystemConfig, user?: IUser): Promise<SystemConfig> {
    if (!this.canCreate(item, user)) {
      throw new Error('Permission denied: Cannot create system configuration');
    }

    const data = this.getDataFromSettings();
    
    if (data[SystemConfigDao.SYSTEM_KEY]) {
      throw new Error('System configuration already exists');
    }

    data[SystemConfigDao.SYSTEM_KEY] = item;
    
    const saved = await this.saveDataToSettings(data);
    if (!saved) {
      throw new Error('Failed to save system configuration');
    }

    return item;
  }
}