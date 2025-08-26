import { IUser, McpSettings, ServerConfig, IGroup, SystemConfig, UserConfig } from '../types/index.js';
import { DaoFactory } from '../dao/index.js';

export interface DataService {
  foo(): void;
  filterData(data: any[], user?: IUser): any[];
  filterSettings(settings: McpSettings, user?: IUser): McpSettings;
  mergeSettings(all: McpSettings, newSettings: McpSettings, user?: IUser): McpSettings;
  getPermissions(user: IUser): string[];
  
  // DAO-based methods
  getUserDao(): typeof DaoFactory.getUserDao;
  getServerDao(): typeof DaoFactory.getServerDao;
  getGroupDao(): typeof DaoFactory.getGroupDao;
  getSystemConfigDao(): typeof DaoFactory.getSystemConfigDao;
  getUserConfigDao(): typeof DaoFactory.getUserConfigDao;
}

export class DataServiceImpl implements DataService {
  foo() {
    console.log('default implementation');
  }

  filterData(data: any[], _user?: IUser): any[] {
    return data;
  }

  filterSettings(settings: McpSettings, user?: IUser): McpSettings {
    const filteredSettings: McpSettings = {
      mcpServers: {},
      users: [],
      groups: [],
    };

    // Filter servers using ServerDao
    const serverDao = DaoFactory.getServerDao();
    const serverData = serverDao.getData() as Record<string, ServerConfig>;
    for (const [name, config] of Object.entries(serverData)) {
      if (serverDao.checkAccess(name, user)) {
        filteredSettings.mcpServers[name] = config;
      }
    }

    // Filter users using UserDao  
    const userDao = DaoFactory.getUserDao();
    const userData = userDao.getData() as IUser[];
    filteredSettings.users = userDao.filterDataByUser(userData, user);

    // Filter groups using GroupDao
    const groupDao = DaoFactory.getGroupDao();
    const groupData = groupDao.getData() as IGroup[];
    filteredSettings.groups = groupDao.filterDataByUser(groupData, user);

    // Include system config for admin users
    if (user?.isAdmin) {
      const systemConfigDao = DaoFactory.getSystemConfigDao();
      const systemData = systemConfigDao.getData() as Record<string, SystemConfig>;
      if (Object.keys(systemData).length > 0) {
        filteredSettings.systemConfig = systemData['system'];
      }

      // Include user configs for admin users
      const userConfigDao = DaoFactory.getUserConfigDao();
      const userConfigData = userConfigDao.getData() as Record<string, UserConfig>;
      if (Object.keys(userConfigData).length > 0) {
        filteredSettings.userConfigs = userConfigData;
      }
    } else {
      // Non-admin users can only see their own user config
      const userConfigDao = DaoFactory.getUserConfigDao();
      const userConfigData = userConfigDao.getData() as Record<string, UserConfig>;
      if (user?.username && userConfigData[user.username]) {
        filteredSettings.userConfigs = {
          [user.username]: userConfigData[user.username]
        };
      }
    }

    return filteredSettings;
  }

  mergeSettings(all: McpSettings, newSettings: McpSettings, user?: IUser): McpSettings {
    // This method should merge new settings into existing ones, respecting permissions
    const merged: McpSettings = { ...all };

    // Merge servers if provided
    if (newSettings.mcpServers) {
      merged.mcpServers = newSettings.mcpServers;
    }

    // Only admin users can modify users, groups, and system config
    if (user?.isAdmin) {
      if (newSettings.users) {
        merged.users = newSettings.users;
      }
      if (newSettings.groups) {
        merged.groups = newSettings.groups;
      }
      if (newSettings.systemConfig) {
        merged.systemConfig = { ...merged.systemConfig, ...newSettings.systemConfig };
      }
      if (newSettings.userConfigs) {
        merged.userConfigs = { ...merged.userConfigs, ...newSettings.userConfigs };
      }
    } else {
      // Non-admin users can only modify their own user config
      if (newSettings.userConfigs && user) {
        merged.userConfigs = merged.userConfigs || {};
        if (newSettings.userConfigs[user.username]) {
          merged.userConfigs[user.username] = newSettings.userConfigs[user.username];
        }
      }
    }

    return merged;
  }

  getPermissions(user: IUser): string[] {
    if (user.isAdmin) {
      return ['*']; // Admin has all permissions
    }
    
    return [
      'read:own-servers',
      'write:own-servers',
      'read:admin-servers',
      'write:admin-servers', // Users can modify admin servers but not delete them
      'read:own-groups',
      'write:own-groups',
      'read:admin-groups',
      'read:own-config',
      'write:own-config',
    ];
  }

  // DAO factory methods
  getUserDao() {
    return DaoFactory.getUserDao;
  }

  getServerDao() {
    return DaoFactory.getServerDao;
  }

  getGroupDao() {
    return DaoFactory.getGroupDao;
  }

  getSystemConfigDao() {
    return DaoFactory.getSystemConfigDao;
  }

  getUserConfigDao() {
    return DaoFactory.getUserConfigDao;
  }
}
