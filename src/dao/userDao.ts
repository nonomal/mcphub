import { IUser, McpSettings } from '../types/index.js';
import { FileBasedDao } from './base.js';
import { loadOriginalSettings, saveSettings } from '../config/index.js';

/**
 * DAO for managing user data
 */
export class UserDao extends FileBasedDao<IUser, string> {
  protected getDataFromSettings(): IUser[] {
    const settings = loadOriginalSettings();
    return settings.users || [];
  }

  protected async saveDataToSettings(data: IUser[]): Promise<boolean> {
    const settings = loadOriginalSettings();
    const updatedSettings: McpSettings = {
      ...settings,
      users: data,
    };
    return saveSettings(updatedSettings);
  }

  protected extractKey(item: IUser): string {
    return item.username;
  }

  protected filterByUser(items: IUser[], user?: IUser): IUser[] {
    // Non-admin users can only see their own user data
    if (!user || !user.isAdmin) {
      return user ? items.filter(item => item.username === user.username) : [];
    }
    // Admin users can see all users
    return items;
  }

  protected canCreate(item: IUser, user?: IUser): boolean {
    // Only admin users can create new users
    return user?.isAdmin === true;
  }

  protected canUpdate(key: string, itemUpdates: Partial<IUser>, user?: IUser): boolean {
    // Admin users can update any user
    if (user?.isAdmin === true) {
      return true;
    }
    // Non-admin users can only update their own data (except isAdmin field)
    if (user && user.username === key) {
      // Non-admin users cannot modify their admin status
      return !itemUpdates.hasOwnProperty('isAdmin');
    }
    return false;
  }

  protected canDelete(key: string, user?: IUser): boolean {
    // Only admin users can delete users
    if (user?.isAdmin !== true) {
      return false;
    }
    // Admin users cannot delete themselves
    return user.username !== key;
  }

  protected canAccess(key: string, user?: IUser): boolean {
    // Admin users can access any user
    if (user?.isAdmin === true) {
      return true;
    }
    // Non-admin users can only access their own data
    return user?.username === key;
  }

  /**
   * Find user by username (convenience method)
   */
  async findByUsername(username: string, user?: IUser): Promise<IUser | null> {
    return this.findByKey(username, user);
  }

  /**
   * Check if a username exists
   */
  async usernameExists(username: string): Promise<boolean> {
    const users = this.getDataFromSettings();
    return users.some(user => user.username === username);
  }

  /**
   * Update user password
   */
  async updatePassword(username: string, hashedPassword: string, user?: IUser): Promise<IUser | null> {
    return this.update(username, { password: hashedPassword }, user);
  }

  /**
   * Update user admin status
   */
  async updateAdminStatus(username: string, isAdmin: boolean, user?: IUser): Promise<IUser | null> {
    return this.update(username, { isAdmin }, user);
  }
}