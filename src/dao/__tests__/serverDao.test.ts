import { ServerDao } from '../serverDao.js';
import { IUser, ServerConfig } from '../../types/index.js';

// Mock the config module
jest.mock('../../config/index.js', () => ({
  loadOriginalSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

import { loadOriginalSettings, saveSettings } from '../../config/index.js';

describe('ServerDao', () => {
  let serverDao: ServerDao;
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

  const adminServer: ServerConfig = {
    command: 'node',
    args: ['server.js'],
    owner: 'admin',
    enabled: true,
  };

  const userServer: ServerConfig = {
    command: 'python',
    args: ['app.py'],
    owner: 'user1',
    enabled: true,
  };

  const mockSettings = {
    mcpServers: {
      'admin-server': adminServer,
      'user-server': userServer,
    },
    users: [],
  };

  beforeEach(() => {
    serverDao = new ServerDao();
    mockLoadSettings = loadOriginalSettings as jest.MockedFunction<typeof loadOriginalSettings>;
    mockSaveSettings = saveSettings as jest.MockedFunction<typeof saveSettings>;
    
    // Create a fresh copy of mock settings for each test
    mockLoadSettings.mockReturnValue({
      mcpServers: {
        'admin-server': { ...adminServer },
        'user-server': { ...userServer },
      },
      users: [],
    });
    mockSaveSettings.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all servers for admin', async () => {
      const servers = await serverDao.findAll(testAdmin);
      expect(servers).toHaveLength(2);
    });

    it('should return only accessible servers for non-admin', async () => {
      const servers = await serverDao.findAll(testUser);
      expect(servers).toHaveLength(2); // Both admin and user1 servers are accessible
    });

    it('should return empty array for no user', async () => {
      const servers = await serverDao.findAll();
      expect(servers).toHaveLength(0);
    });
  });

  describe('findByKey', () => {
    it('should return server by name for admin', async () => {
      const server = await serverDao.findByKey('admin-server', testAdmin);
      expect(server).toEqual(adminServer);
    });

    it('should return admin-owned server for non-admin', async () => {
      const server = await serverDao.findByKey('admin-server', testUser);
      expect(server).toEqual(adminServer);
    });

    it('should return own server for non-admin', async () => {
      const server = await serverDao.findByKey('user-server', testUser);
      expect(server).toEqual(userServer);
    });
  });

  describe('createWithName', () => {
    const newServer: ServerConfig = {
      command: 'docker',
      args: ['run', 'app'],
      owner: 'user1',
      enabled: true,
    };

    it('should allow admin to create any server', async () => {
      const created = await serverDao.createWithName('new-server', newServer, testAdmin);
      expect(created).toEqual(newServer);
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          mcpServers: expect.objectContaining({
            'new-server': newServer,
          }),
        })
      );
    });

    it('should allow user to create own server', async () => {
      const created = await serverDao.createWithName('user-new-server', newServer, testUser);
      expect(created).toEqual(newServer);
    });

    it('should not allow user to create admin-owned server', async () => {
      const adminOwnedServer: ServerConfig = {
        ...newServer,
        owner: 'admin',
      };

      await expect(
        serverDao.createWithName('admin-new-server', adminOwnedServer, testUser)
      ).rejects.toThrow('Permission denied: Cannot create server');
    });

    it('should not allow duplicate server names', async () => {
      await expect(
        serverDao.createWithName('admin-server', newServer, testAdmin)
      ).rejects.toThrow('Server with name admin-server already exists');
    });
  });

  describe('update', () => {
    it('should allow admin to update any server', async () => {
      const updates = { enabled: false };
      const updated = await serverDao.update('admin-server', updates, testAdmin);
      
      expect(updated).toEqual({ ...adminServer, ...updates });
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to update own server', async () => {
      const updates = { enabled: false };
      const updated = await serverDao.update('user-server', updates, testUser);
      
      expect(updated).toEqual({ ...userServer, ...updates });
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to update admin-owned server', async () => {
      const updates = { enabled: false };
      const updated = await serverDao.update('admin-server', updates, testUser);
      
      expect(updated).toEqual({ ...adminServer, ...updates });
    });
  });

  describe('delete', () => {
    it('should allow admin to delete any server', async () => {
      const deleted = await serverDao.delete('user-server', testAdmin);
      expect(deleted).toBe(true);
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to delete own server but not admin servers', async () => {
      // This should succeed - user deleting their own server
      const deleted = await serverDao.delete('user-server', testUser);
      expect(deleted).toBe(true);
    });

    it('should not allow user to delete admin-owned server', async () => {
      await expect(serverDao.delete('admin-server', testUser)).rejects.toThrow(
        'Permission denied: Cannot delete item'
      );
    });
  });

  describe('convenience methods', () => {
    it('should get all server names for fresh data', async () => {
      const names = await serverDao.getAllServerNames(testAdmin);
      expect(names).toContain('admin-server');
      expect(names).toContain('user-server');
      expect(names).toHaveLength(2);
    });

    it('should get server config by name for fresh data', async () => {
      const config = await serverDao.getServerConfig('admin-server', testAdmin);
      expect(config).toEqual(adminServer);
    });

    it('should update server config', async () => {
      const updates = { enabled: false };
      const updated = await serverDao.updateServerConfig('admin-server', updates, testAdmin);
      
      expect(updated?.enabled).toBe(false);
    });

    it('should set server enabled status', async () => {
      const updated = await serverDao.setServerEnabled('admin-server', false, testAdmin);
      
      expect(updated?.enabled).toBe(false);
    });

    it('should get servers by owner for fresh data', async () => {
      const userServers = await serverDao.getServersByOwner('user1', testAdmin);
      expect(Object.keys(userServers)).toContain('user-server');
      expect(Object.keys(userServers)).toHaveLength(1);
    });
  });

  describe('create method override', () => {
    it('should throw error when using create method directly', async () => {
      const newServer: ServerConfig = {
        command: 'node',
        args: ['app.js'],
      };

      await expect(serverDao.create(newServer, testAdmin)).rejects.toThrow(
        'Use createWithName method for ServerDao instead of create'
      );
    });
  });
});