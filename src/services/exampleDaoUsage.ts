import { DaoFactory } from '../dao/index.js';
import { IUser, ServerConfig, IGroup, SystemConfig, UserConfig } from '../types/index.js';

/**
 * Example service demonstrating how to use the DAO layer
 * This service provides high-level operations that use the DAO layer
 */
export class ExampleDaoUsageService {
  
  /**
   * Get all servers accessible to a user
   */
  async getUserServers(user: IUser): Promise<Record<string, ServerConfig>> {
    const serverDao = DaoFactory.getServerDao();
    const servers: Record<string, ServerConfig> = {};
    
    const serverNames = await serverDao.getAllServerNames(user);
    
    for (const name of serverNames) {
      const config = await serverDao.getServerConfig(name, user);
      if (config) {
        servers[name] = config;
      }
    }
    
    return servers;
  }

  /**
   * Create a new server for a user
   */
  async createUserServer(
    serverName: string, 
    config: ServerConfig, 
    user: IUser
  ): Promise<ServerConfig> {
    const serverDao = DaoFactory.getServerDao();
    
    // Set owner if not specified
    if (!config.owner) {
      config.owner = user.username;
    }
    
    return serverDao.createWithName(serverName, config, user);
  }

  /**
   * Get all groups accessible to a user
   */
  async getUserGroups(user: IUser): Promise<IGroup[]> {
    const groupDao = DaoFactory.getGroupDao();
    return groupDao.findAll(user);
  }

  /**
   * Create a new group for a user
   */
  async createUserGroup(group: IGroup, user: IUser): Promise<IGroup> {
    const groupDao = DaoFactory.getGroupDao();
    
    // Set owner if not specified
    if (!group.owner) {
      group.owner = user.username;
    }
    
    return groupDao.create(group, user);
  }

  /**
   * Add a server to a group
   */
  async addServerToGroup(
    groupId: string, 
    serverName: string, 
    user: IUser
  ): Promise<IGroup | null> {
    const groupDao = DaoFactory.getGroupDao();
    const serverDao = DaoFactory.getServerDao();
    
    // Check if server exists and user has access
    const serverExists = await serverDao.exists(serverName, user);
    if (!serverExists) {
      throw new Error(`Server ${serverName} not found or not accessible`);
    }
    
    return groupDao.addServerToGroup(groupId, serverName, user);
  }

  /**
   * Get user profile with accessible data
   */
  async getUserProfile(username: string, requestingUser: IUser): Promise<{
    user: IUser | null;
    servers: Record<string, ServerConfig>;
    groups: IGroup[];
    userConfig?: UserConfig;
  }> {
    const userDao = DaoFactory.getUserDao();
    const serverDao = DaoFactory.getServerDao();
    const groupDao = DaoFactory.getGroupDao();
    const userConfigDao = DaoFactory.getUserConfigDao();
    
    // Get user info
    const user = await userDao.findByUsername(username, requestingUser);
    
    if (!user) {
      throw new Error(`User ${username} not found or not accessible`);
    }
    
    // Get user's servers
    const servers = await serverDao.getServersByOwner(username, requestingUser);
    
    // Get user's groups
    const groups = await groupDao.getGroupsByOwner(username, requestingUser);
    
    // Get user config if accessible
    let userConfig: UserConfig | undefined;
    try {
      userConfig = await userConfigDao.getUserConfig(username, requestingUser) || undefined;
    } catch (error) {
      // User config not accessible, ignore
    }
    
    return {
      user,
      servers,
      groups,
      userConfig,
    };
  }

  /**
   * Update system configuration (admin only)
   */
  async updateSystemConfig(
    updates: Partial<SystemConfig>, 
    user: IUser
  ): Promise<SystemConfig> {
    if (!user.isAdmin) {
      throw new Error('Only admin users can update system configuration');
    }
    
    const systemConfigDao = DaoFactory.getSystemConfigDao();
    
    // Get current config or create new one
    const current = await systemConfigDao.getSystemConfig(user);
    
    if (current) {
      const updated = await systemConfigDao.update('system', updates, user);
      if (!updated) {
        throw new Error('Failed to update system configuration');
      }
      return updated;
    } else {
      return systemConfigDao.create(updates as SystemConfig, user);
    }
  }

  /**
   * Set user-specific configuration
   */
  async setUserConfig(
    username: string, 
    config: UserConfig, 
    requestingUser: IUser
  ): Promise<UserConfig> {
    const userConfigDao = DaoFactory.getUserConfigDao();
    
    // Users can only set their own config unless they're admin
    if (!requestingUser.isAdmin && requestingUser.username !== username) {
      throw new Error('Cannot set configuration for other users');
    }
    
    return userConfigDao.setUserConfig(username, config, requestingUser);
  }

  /**
   * Get comprehensive dashboard data for a user
   */
  async getDashboardData(user: IUser): Promise<{
    servers: Record<string, ServerConfig>;
    groups: IGroup[];
    systemConfig?: SystemConfig;
    userConfig?: UserConfig;
    stats: {
      totalServers: number;
      ownedServers: number;
      totalGroups: number;
      ownedGroups: number;
    };
  }> {
    const serverDao = DaoFactory.getServerDao();
    const groupDao = DaoFactory.getGroupDao();
    const systemConfigDao = DaoFactory.getSystemConfigDao();
    const userConfigDao = DaoFactory.getUserConfigDao();
    
    // Get all accessible servers
    const servers = await this.getUserServers(user);
    
    // Get all accessible groups
    const groups = await this.getUserGroups(user);
    
    // Get system config if admin
    let systemConfig: SystemConfig | undefined;
    if (user.isAdmin) {
      systemConfig = await systemConfigDao.getSystemConfig(user) || undefined;
    }
    
    // Get user config
    let userConfig: UserConfig | undefined;
    try {
      userConfig = await userConfigDao.getUserConfig(user.username, user) || undefined;
    } catch (error) {
      // User config not accessible, ignore
    }
    
    // Calculate stats
    const ownedServers = await serverDao.getServersByOwner(user.username, user);
    const ownedGroups = await groupDao.getGroupsByOwner(user.username, user);
    
    return {
      servers,
      groups,
      systemConfig,
      userConfig,
      stats: {
        totalServers: Object.keys(servers).length,
        ownedServers: Object.keys(ownedServers).length,
        totalGroups: groups.length,
        ownedGroups: ownedGroups.length,
      },
    };
  }
}