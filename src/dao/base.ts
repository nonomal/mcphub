import { IUser } from '../types/index.js';

/**
 * Base interface for all DAO operations
 */
export interface BaseDao<T, K = string> {
  /**
   * Find all items
   * @param user - The user making the request (for permission filtering)
   * @returns Array of items
   */
  findAll(user?: IUser): Promise<T[]>;

  /**
   * Find item by key/id
   * @param key - The key or id to search for
   * @param user - The user making the request (for permission filtering)
   * @returns The item if found, null otherwise
   */
  findByKey(key: K, user?: IUser): Promise<T | null>;

  /**
   * Create a new item
   * @param item - The item to create
   * @param user - The user making the request (for permission checking)
   * @returns The created item
   */
  create(item: T, user?: IUser): Promise<T>;

  /**
   * Update an existing item
   * @param key - The key or id of the item to update
   * @param item - The updated item data
   * @param user - The user making the request (for permission checking)
   * @returns The updated item if successful, null otherwise
   */
  update(key: K, item: Partial<T>, user?: IUser): Promise<T | null>;

  /**
   * Delete an item
   * @param key - The key or id of the item to delete
   * @param user - The user making the request (for permission checking)
   * @returns True if deleted successfully, false otherwise
   */
  delete(key: K, user?: IUser): Promise<boolean>;

  /**
   * Check if an item exists
   * @param key - The key or id to check
   * @param user - The user making the request (for permission filtering)
   * @returns True if the item exists, false otherwise
   */
  exists(key: K, user?: IUser): Promise<boolean>;
}

/**
 * Abstract base class for file-based DAO implementations
 */
export abstract class FileBasedDao<T, K = string> implements BaseDao<T, K> {
  protected abstract getDataFromSettings(): Record<string, any> | T[];
  protected abstract saveDataToSettings(data: Record<string, any> | T[]): Promise<boolean>;
  protected abstract extractKey(item: T): K;
  protected abstract filterByUser(items: T[], user?: IUser): T[];
  protected abstract canCreate(item: T, user?: IUser): boolean;
  protected abstract canUpdate(key: K, item: Partial<T>, user?: IUser): boolean;
  protected abstract canDelete(key: K, user?: IUser): boolean;
  protected abstract canAccess(key: K, user?: IUser): boolean;

  // Public accessor methods for DataService integration
  public getData(): Record<string, any> | T[] {
    return this.getDataFromSettings();
  }

  public filterDataByUser(items: T[], user?: IUser): T[] {
    return this.filterByUser(items, user);
  }

  public checkAccess(key: K, user?: IUser): boolean {
    return this.canAccess(key, user);
  }

  async findAll(user?: IUser): Promise<T[]> {
    const data = this.getDataFromSettings();
    const items = Array.isArray(data) ? data : Object.values(data) as T[];
    return this.filterByUser(items, user);
  }

  async findByKey(key: K, user?: IUser): Promise<T | null> {
    if (!this.canAccess(key, user)) {
      return null;
    }

    const data = this.getDataFromSettings();
    if (Array.isArray(data)) {
      return data.find(item => this.extractKey(item) === key) || null;
    } else {
      return (data as Record<string, T>)[key as string] || null;
    }
  }

  async create(item: T, user?: IUser): Promise<T> {
    if (!this.canCreate(item, user)) {
      throw new Error('Permission denied: Cannot create item');
    }

    const data = this.getDataFromSettings();
    const key = this.extractKey(item);

    if (Array.isArray(data)) {
      // Check for duplicates
      const existingIndex = data.findIndex(existing => this.extractKey(existing) === key);
      if (existingIndex !== -1) {
        throw new Error(`Item with key ${key} already exists`);
      }
      data.push(item);
    } else {
      if ((data as Record<string, T>)[key as string]) {
        throw new Error(`Item with key ${key} already exists`);
      }
      (data as Record<string, T>)[key as string] = item;
    }

    const saved = await this.saveDataToSettings(data);
    if (!saved) {
      throw new Error('Failed to save data');
    }

    return item;
  }

  async update(key: K, itemUpdates: Partial<T>, user?: IUser): Promise<T | null> {
    if (!this.canUpdate(key, itemUpdates, user)) {
      throw new Error('Permission denied: Cannot update item');
    }

    const data = this.getDataFromSettings();
    let updated: T | null = null;

    if (Array.isArray(data)) {
      const index = data.findIndex(item => this.extractKey(item) === key);
      if (index !== -1) {
        data[index] = { ...data[index], ...itemUpdates };
        updated = data[index];
      }
    } else {
      const existing = (data as Record<string, T>)[key as string];
      if (existing) {
        (data as Record<string, T>)[key as string] = { ...existing, ...itemUpdates };
        updated = (data as Record<string, T>)[key as string];
      }
    }

    if (updated) {
      const saved = await this.saveDataToSettings(data);
      if (!saved) {
        throw new Error('Failed to save data');
      }
    }

    return updated;
  }

  async delete(key: K, user?: IUser): Promise<boolean> {
    if (!this.canDelete(key, user)) {
      throw new Error('Permission denied: Cannot delete item');
    }

    const data = this.getDataFromSettings();
    let deleted = false;

    if (Array.isArray(data)) {
      const index = data.findIndex(item => this.extractKey(item) === key);
      if (index !== -1) {
        data.splice(index, 1);
        deleted = true;
      }
    } else {
      if ((data as Record<string, T>)[key as string]) {
        delete (data as Record<string, T>)[key as string];
        deleted = true;
      }
    }

    if (deleted) {
      const saved = await this.saveDataToSettings(data);
      if (!saved) {
        throw new Error('Failed to save data');
      }
    }

    return deleted;
  }

  async exists(key: K, user?: IUser): Promise<boolean> {
    const item = await this.findByKey(key, user);
    return item !== null;
  }
}