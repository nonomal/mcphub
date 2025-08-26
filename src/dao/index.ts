export type { BaseDao } from './base.js';
export { FileBasedDao } from './base.js';
export { UserDao } from './userDao.js';
export { ServerDao } from './serverDao.js';
export { GroupDao } from './groupDao.js';
export { SystemConfigDao } from './systemConfigDao.js';
export { UserConfigDao } from './userConfigDao.js';

import { UserDao } from './userDao.js';
import { ServerDao } from './serverDao.js';
import { GroupDao } from './groupDao.js';
import { SystemConfigDao } from './systemConfigDao.js';
import { UserConfigDao } from './userConfigDao.js';

// Factory function to create DAO instances
export class DaoFactory {
  private static userDao: UserDao | null = null;
  private static serverDao: ServerDao | null = null;
  private static groupDao: GroupDao | null = null;
  private static systemConfigDao: SystemConfigDao | null = null;
  private static userConfigDao: UserConfigDao | null = null;

  static getUserDao(): UserDao {
    if (!this.userDao) {
      this.userDao = new UserDao();
    }
    return this.userDao;
  }

  static getServerDao(): ServerDao {
    if (!this.serverDao) {
      this.serverDao = new ServerDao();
    }
    return this.serverDao;
  }

  static getGroupDao(): GroupDao {
    if (!this.groupDao) {
      this.groupDao = new GroupDao();
    }
    return this.groupDao;
  }

  static getSystemConfigDao(): SystemConfigDao {
    if (!this.systemConfigDao) {
      this.systemConfigDao = new SystemConfigDao();
    }
    return this.systemConfigDao;
  }

  static getUserConfigDao(): UserConfigDao {
    if (!this.userConfigDao) {
      this.userConfigDao = new UserConfigDao();
    }
    return this.userConfigDao;
  }

  /**
   * Clear all cached DAO instances (useful for testing)
   */
  static clearCache(): void {
    this.userDao = null;
    this.serverDao = null;
    this.groupDao = null;
    this.systemConfigDao = null;
    this.userConfigDao = null;
  }
}