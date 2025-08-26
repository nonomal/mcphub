import { UserDao } from '../userDao.js';
import { IUser } from '../../types/index.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock the config module
jest.mock('../../config/index.js', () => ({
  loadOriginalSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

import { loadOriginalSettings, saveSettings } from '../../config/index.js';

describe('UserDao', () => {
  let userDao: UserDao;
  let mockLoadSettings: jest.MockedFunction<typeof loadOriginalSettings>;
  let mockSaveSettings: jest.MockedFunction<typeof saveSettings>;

  const testAdmin: IUser = {
    username: 'admin',
    password: 'hashedPassword',
    isAdmin: true,
  };

  const testUser: IUser = {
    username: 'user1',
    password: 'hashedPassword',
    isAdmin: false,
  };

  const mockSettings = {
    mcpServers: {},
    users: [testAdmin, testUser],
  };

  beforeEach(() => {
    userDao = new UserDao();
    mockLoadSettings = loadOriginalSettings as jest.MockedFunction<typeof loadOriginalSettings>;
    mockSaveSettings = saveSettings as jest.MockedFunction<typeof saveSettings>;
    
    // Create a fresh copy of mock settings for each test
    mockLoadSettings.mockReturnValue({
      mcpServers: {},
      users: [{ ...testAdmin }, { ...testUser }],
    });
    mockSaveSettings.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users for admin', async () => {
      const users = await userDao.findAll(testAdmin);
      expect(users).toHaveLength(2);
      expect(users).toContainEqual(expect.objectContaining({ username: 'admin' }));
      expect(users).toContainEqual(expect.objectContaining({ username: 'user1' }));
    });

    it('should return only own user for non-admin', async () => {
      const users = await userDao.findAll(testUser);
      expect(users).toHaveLength(1);
      expect(users[0]).toEqual(testUser);
    });

    it('should return empty array for no user', async () => {
      const users = await userDao.findAll();
      expect(users).toHaveLength(0);
    });
  });

  describe('findByKey', () => {
    it('should return user by username for admin', async () => {
      const user = await userDao.findByKey('user1', testAdmin);
      expect(user).toEqual(testUser);
    });

    it('should return own user for non-admin', async () => {
      const user = await userDao.findByKey('user1', testUser);
      expect(user).toEqual(testUser);
    });

    it('should return null when non-admin tries to access other user', async () => {
      const user = await userDao.findByKey('admin', testUser);
      expect(user).toBeNull();
    });
  });

  describe('create', () => {
    const newUser: IUser = {
      username: 'newuser',
      password: 'hashedPassword',
      isAdmin: false,
    };

    it('should allow admin to create user', async () => {
      const created = await userDao.create(newUser, testAdmin);
      expect(created).toEqual(newUser);
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          users: expect.arrayContaining([newUser]),
        })
      );
    });

    it('should not allow non-admin to create user', async () => {
      await expect(userDao.create(newUser, testUser)).rejects.toThrow(
        'Permission denied: Cannot create item'
      );
    });

    it('should not allow duplicate usernames', async () => {
      const duplicateUser: IUser = {
        username: 'admin', // Already exists
        password: 'hashedPassword',
        isAdmin: false,
      };

      await expect(userDao.create(duplicateUser, testAdmin)).rejects.toThrow(
        'Item with key admin already exists'
      );
    });
  });

  describe('update', () => {
    it('should allow admin to update any user', async () => {
      const updates = { isAdmin: true };
      const updated = await userDao.update('user1', updates, testAdmin);
      
      expect(updated).toEqual({ ...testUser, ...updates });
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to update own data (except isAdmin)', async () => {
      const updates = { password: 'newHashedPassword' };
      const updated = await userDao.update('user1', updates, testUser);
      
      expect(updated).toEqual({ ...testUser, ...updates });
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should not allow non-admin to update isAdmin field', async () => {
      const updates = { isAdmin: true };
      await expect(userDao.update('user1', updates, testUser)).rejects.toThrow(
        'Permission denied: Cannot update item'
      );
    });

    it('should not allow user to update other users', async () => {
      const updates = { password: 'newHashedPassword' };
      await expect(userDao.update('admin', updates, testUser)).rejects.toThrow(
        'Permission denied: Cannot update item'
      );
    });
  });

  describe('delete', () => {
    it('should allow admin to delete other users', async () => {
      const deleted = await userDao.delete('user1', testAdmin);
      expect(deleted).toBe(true);
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should not allow admin to delete themselves', async () => {
      await expect(userDao.delete('admin', testAdmin)).rejects.toThrow(
        'Permission denied: Cannot delete item'
      );
    });

    it('should not allow non-admin to delete users', async () => {
      await expect(userDao.delete('admin', testUser)).rejects.toThrow(
        'Permission denied: Cannot delete item'
      );
    });
  });

  describe('convenience methods', () => {
    it('should find user by username', async () => {
      const user = await userDao.findByUsername('user1', testAdmin);
      expect(user).toEqual(testUser);
    });

    it('should check if username exists', async () => {
      const exists = await userDao.usernameExists('user1');
      expect(exists).toBe(true);

      const notExists = await userDao.usernameExists('nonexistent');
      expect(notExists).toBe(false);
    });

    it('should update password', async () => {
      const newPassword = 'newHashedPassword';
      const updated = await userDao.updatePassword('user1', newPassword, testAdmin);
      
      expect(updated?.password).toBe(newPassword);
    });

    it('should update admin status', async () => {
      const updated = await userDao.updateAdminStatus('user1', true, testAdmin);
      
      expect(updated?.isAdmin).toBe(true);
    });
  });
});