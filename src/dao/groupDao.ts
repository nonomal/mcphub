import { IUser, IGroup, IGroupServerConfig, McpSettings } from '../types/index.js';
import { FileBasedDao } from './base.js';
import { loadOriginalSettings, saveSettings } from '../config/index.js';

/**
 * DAO for managing group data
 */
export class GroupDao extends FileBasedDao<IGroup, string> {
  protected getDataFromSettings(): IGroup[] {
    const settings = loadOriginalSettings();
    return settings.groups || [];
  }

  protected async saveDataToSettings(data: IGroup[]): Promise<boolean> {
    const settings = loadOriginalSettings();
    const updatedSettings: McpSettings = {
      ...settings,
      groups: data,
    };
    return saveSettings(updatedSettings);
  }

  protected extractKey(item: IGroup): string {
    return item.id;
  }

  protected filterByUser(items: IGroup[], user?: IUser): IGroup[] {
    if (!user) {
      return [];
    }

    return items.filter(group => {
      // If no owner specified, default to 'admin'
      const owner = group.owner || 'admin';
      
      // Admin users can see all groups
      if (user.isAdmin === true) {
        return true;
      }
      
      // Non-admin users can only see their own groups or groups owned by 'admin'
      return owner === user.username || owner === 'admin';
    });
  }

  protected canCreate(item: IGroup, user?: IUser): boolean {
    // Admin users can create any group
    if (user?.isAdmin === true) {
      return true;
    }
    
    // Non-admin users can create groups owned by themselves
    const owner = item.owner || 'admin';
    return user?.username === owner;
  }

  protected canUpdate(key: string, itemUpdates: Partial<IGroup>, user?: IUser): boolean {
    const groups = this.getDataFromSettings();
    const group = groups.find(g => g.id === key);
    
    if (!group) {
      return false;
    }

    // Admin users can update any group
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can only update their own groups
    const owner = group.owner || 'admin';
    return user?.username === owner;
  }

  protected canDelete(key: string, user?: IUser): boolean {
    const groups = this.getDataFromSettings();
    const group = groups.find(g => g.id === key);
    
    if (!group) {
      return false;
    }

    // Admin users can delete any group
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can only delete their own groups (not admin-owned groups)
    const owner = group.owner || 'admin';
    return user?.username === owner && owner !== 'admin';
  }

  protected canAccess(key: string, user?: IUser): boolean {
    const groups = this.getDataFromSettings();
    const group = groups.find(g => g.id === key);
    
    if (!group) {
      return false;
    }

    // Admin users can access any group
    if (user?.isAdmin === true) {
      return true;
    }

    // Non-admin users can access their own groups or admin-owned groups
    const owner = group.owner || 'admin';
    return user?.username === owner || owner === 'admin';
  }

  /**
   * Find group by name
   */
  async findByName(name: string, user?: IUser): Promise<IGroup | null> {
    const groups = await this.findAll(user);
    return groups.find(group => group.name === name) || null;
  }

  /**
   * Check if a group name exists
   */
  async nameExists(name: string): Promise<boolean> {
    const groups = this.getDataFromSettings();
    return groups.some(group => group.name === name);
  }

  /**
   * Check if a group id exists
   */
  async idExists(id: string): Promise<boolean> {
    const groups = this.getDataFromSettings();
    return groups.some(group => group.id === id);
  }

  /**
   * Get groups by owner
   */
  async getGroupsByOwner(owner: string, user?: IUser): Promise<IGroup[]> {
    const groups = await this.findAll(user);
    return groups.filter(group => (group.owner || 'admin') === owner);
  }

  /**
   * Get groups containing a specific server
   */
  async getGroupsContainingServer(serverName: string, user?: IUser): Promise<IGroup[]> {
    const groups = await this.findAll(user);
    return groups.filter(group => {
      if (Array.isArray(group.servers)) {
        return group.servers.some(server => {
          if (typeof server === 'string') {
            return server === serverName;
          } else {
            return server.name === serverName;
          }
        });
      }
      return false;
    });
  }

  /**
   * Add server to group
   */
  async addServerToGroup(groupId: string, serverName: string, user?: IUser): Promise<IGroup | null> {
    const group = await this.findByKey(groupId, user);
    if (!group) {
      return null;
    }

    // Ensure servers is an array
    if (!Array.isArray(group.servers)) {
      group.servers = [];
    }

    // Check if server already exists in group
    const serverExists = group.servers.some(server => {
      if (typeof server === 'string') {
        return server === serverName;
      } else {
        return server.name === serverName;
      }
    });

    if (serverExists) {
      throw new Error(`Server ${serverName} already exists in group ${group.name}`);
    }

    // Type-safe addition based on current array type
    if (group.servers.length === 0 || typeof group.servers[0] === 'string') {
      (group.servers as string[]).push(serverName);
    } else {
      (group.servers as IGroupServerConfig[]).push({ name: serverName });
    }
    
    return this.update(groupId, { servers: group.servers }, user);
  }

  /**
   * Remove server from group
   */
  async removeServerFromGroup(groupId: string, serverName: string, user?: IUser): Promise<IGroup | null> {
    const group = await this.findByKey(groupId, user);
    if (!group) {
      return null;
    }

    if (!Array.isArray(group.servers)) {
      return group; // No servers to remove
    }

    // Type-safe filtering based on current array type
    let updatedServers: string[] | IGroupServerConfig[];
    
    if (group.servers.length === 0 || typeof group.servers[0] === 'string') {
      updatedServers = (group.servers as string[]).filter(server => server !== serverName);
    } else {
      updatedServers = (group.servers as IGroupServerConfig[]).filter(server => server.name !== serverName);
    }

    return this.update(groupId, { servers: updatedServers }, user);
  }

  /**
   * Update group servers
   */
  async updateGroupServers(groupId: string, servers: string[] | IGroupServerConfig[], user?: IUser): Promise<IGroup | null> {
    return this.update(groupId, { servers }, user);
  }
}