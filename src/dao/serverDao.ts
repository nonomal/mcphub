import { IUser, ServerConfig, McpSettings } from '../types/index.js';
import { FileBasedDao } from './base.js';
import { loadOriginalSettings, saveSettings } from '../config/index.js';

/**
 * DAO for managing server configuration data
 */
export class ServerDao extends FileBasedDao<ServerConfig, string> {
  protected getDataFromSettings(): Record<string, ServerConfig> {
    const settings = loadOriginalSettings();
    return settings.mcpServers || {};
  }

  protected async saveDataToSettings(data: Record<string, ServerConfig>): Promise<boolean> {
    const settings = loadOriginalSettings();
    const updatedSettings: McpSettings = {
      ...settings,
      mcpServers: data,
    };
    return saveSettings(updatedSettings);
  }

  protected extractKey(_item: ServerConfig & { name?: string }): string {
    // For servers, we need to pass the key separately since ServerConfig doesn't contain the name
    // This will be handled by overriding the create method
    throw new Error('extractKey should not be called directly for ServerDao. Use createWithName instead.');
  }

  protected filterByUser(items: ServerConfig[], user?: IUser): ServerConfig[] {
    // Filter servers based on ownership
    return items.filter(server => {
      // If no owner specified, default to 'admin'
      const owner = server.owner || 'admin';
      
      // Admin users can see all servers
      if (!user || user.isAdmin === true) {
        return true;
      }
      
      // Non-admin users can only see their own servers or servers owned by 'admin'
      return owner === user.username || owner === 'admin';
    });
  }

  protected canCreate(item: ServerConfig, user?: IUser): boolean {
    // Admin users can create any server
    if (user?.isAdmin === true) {
      return true;
    }
    
    // Non-admin users can create servers owned by themselves
    const owner = item.owner || 'admin';
    return user?.username === owner;
  }

  protected canUpdate(key: string, itemUpdates: Partial<ServerConfig>, user?: IUser): boolean {
    const serverData = this.getDataFromSettings();
    const server = serverData[key];
    
    if (!server) {
      return false;
    }

    // Admin users can update any server
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can update their own servers AND admin-owned servers
    const owner = server.owner || 'admin';
    return user?.username === owner || owner === 'admin';
  }

  protected canDelete(key: string, user?: IUser): boolean {
    const serverData = this.getDataFromSettings();
    const server = serverData[key];
    
    if (!server) {
      return false;
    }

    // Admin users can delete any server
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can delete their own servers (including admin-owned servers they created)
    const owner = server.owner || 'admin';
    return user?.username === owner;
  }

  protected canAccess(key: string, user?: IUser): boolean {
    const serverData = this.getDataFromSettings();
    const server = serverData[key];
    
    if (!server) {
      return false;
    }

    // Admin users can access any server
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can access their own servers or admin-owned servers
    const owner = server.owner || 'admin';
    return user?.username === owner || owner === 'admin';
  }

  /**
   * Create a server with a specific name
   */
  async createWithName(name: string, config: ServerConfig, user?: IUser): Promise<ServerConfig> {
    if (!this.canCreate(config, user)) {
      throw new Error('Permission denied: Cannot create server');
    }

    const serverData = this.getDataFromSettings();
    
    if (serverData[name]) {
      throw new Error(`Server with name ${name} already exists`);
    }

    serverData[name] = config;
    
    const saved = await this.saveDataToSettings(serverData);
    if (!saved) {
      throw new Error('Failed to save server data');
    }

    return config;
  }

  /**
   * Override create method to require name parameter
   */
  async create(_item: ServerConfig, _user?: IUser): Promise<ServerConfig> {
    throw new Error('Use createWithName method for ServerDao instead of create');
  }

  /**
   * Get all server names
   */
  async getAllServerNames(user?: IUser): Promise<string[]> {
    const serverData = this.getDataFromSettings();
    const filteredServers: Record<string, ServerConfig> = {};
    
    for (const [name, config] of Object.entries(serverData)) {
      if (this.canAccess(name, user)) {
        filteredServers[name] = config;
      }
    }
    
    return Object.keys(filteredServers);
  }

  /**
   * Get server configuration by name
   */
  async getServerConfig(name: string, user?: IUser): Promise<ServerConfig | null> {
    return this.findByKey(name, user);
  }

  /**
   * Update server configuration
   */
  async updateServerConfig(name: string, config: Partial<ServerConfig>, user?: IUser): Promise<ServerConfig | null> {
    return this.update(name, config, user);
  }

  /**
   * Enable/disable a server
   */
  async setServerEnabled(name: string, enabled: boolean, user?: IUser): Promise<ServerConfig | null> {
    return this.update(name, { enabled }, user);
  }

  /**
   * Get servers by owner
   */
  async getServersByOwner(owner: string, user?: IUser): Promise<Record<string, ServerConfig>> {
    const serverData = this.getDataFromSettings();
    const result: Record<string, ServerConfig> = {};
    
    for (const [name, config] of Object.entries(serverData)) {
      const serverOwner = config.owner || 'admin';
      if (serverOwner === owner && this.canAccess(name, user)) {
        result[name] = config;
      }
    }
    
    return result;
  }
}