import { DaoFactory } from '../index.js';
import { IUser, ServerConfig, IGroup } from '../../types/index.js';
import { ExampleDaoUsageService } from '../../services/exampleDaoUsage.js';

// Mock the config module to provide test data
jest.mock('../../config/index.js', () => ({
  loadOriginalSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

import { loadOriginalSettings, saveSettings } from '../../config/index.js';

describe('DAO Integration Tests', () => {
  let mockLoadSettings: jest.MockedFunction<typeof loadOriginalSettings>;
  let mockSaveSettings: jest.MockedFunction<typeof saveSettings>;
  let exampleService: ExampleDaoUsageService;

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
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['server.js'],
        owner: 'admin',
        enabled: true,
      } as ServerConfig,
      'user-server': {
        command: 'python',
        args: ['app.py'],
        owner: 'user1',
        enabled: true,
      } as ServerConfig,
    },
    users: [testAdmin, testUser],
    groups: [
      {
        id: 'test-group-id',
        name: 'Test Group',
        description: 'A test group',
        servers: ['test-server'],
        owner: 'admin',
      } as IGroup,
    ],
  };

  beforeEach(() => {
    // Clear DAO cache
    DaoFactory.clearCache();
    
    mockLoadSettings = loadOriginalSettings as jest.MockedFunction<typeof loadOriginalSettings>;
    mockSaveSettings = saveSettings as jest.MockedFunction<typeof saveSettings>;
    
    mockLoadSettings.mockReturnValue({ ...mockSettings });
    mockSaveSettings.mockReturnValue(true);
    
    exampleService = new ExampleDaoUsageService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Cross-DAO Operations', () => {
    it('should create a server and add it to a group', async () => {
      const newServerConfig: ServerConfig = {
        command: 'docker',
        args: ['run', 'app'],
        enabled: true,
      };

      // Create a new server
      const createdServer = await exampleService.createUserServer(
        'new-server',
        newServerConfig,
        testUser
      );

      expect(createdServer.owner).toBe('user1');
      expect(mockSaveSettings).toHaveBeenCalled();

      // Add the server to a group
      const updatedGroup = await exampleService.addServerToGroup(
        'test-group-id',
        'new-server',
        testAdmin
      );

      expect(updatedGroup?.servers).toContain('new-server');
    });

    it('should get comprehensive user profile', async () => {
      const profile = await exampleService.getUserProfile('user1', testAdmin);

      expect(profile.user).toEqual(expect.objectContaining({ username: 'user1' }));
      expect(profile.servers).toHaveProperty('user-server');
      expect(profile.groups).toHaveLength(0); // user1 has no groups in test data
    });

    it('should get dashboard data for admin user', async () => {
      const dashboardData = await exampleService.getDashboardData(testAdmin);

      expect(dashboardData.servers).toHaveProperty('test-server');
      expect(dashboardData.servers).toHaveProperty('user-server');
      expect(dashboardData.groups).toHaveLength(1);
      // Total servers include the one created in previous test
      expect(dashboardData.stats.totalServers).toBeGreaterThanOrEqual(2);
      expect(dashboardData.stats.totalGroups).toBe(1);
    });

    it('should get dashboard data for regular user', async () => {
      const dashboardData = await exampleService.getDashboardData(testUser);

      // User can see admin servers and their own servers
      expect(dashboardData.servers).toHaveProperty('test-server');
      expect(dashboardData.servers).toHaveProperty('user-server');
      expect(dashboardData.groups).toHaveLength(1); // Can see admin group
      // Owned servers count may be affected by previous tests
      expect(dashboardData.stats.ownedServers).toBeGreaterThanOrEqual(1); // Owns at least user-server
    });
  });

  describe('Permission Validation', () => {
    it('should prevent non-admin from creating admin-owned resources', async () => {
      const adminServerConfig: ServerConfig = {
        command: 'node',
        args: ['admin-only.js'],
        owner: 'admin',
        enabled: true,
      };

      await expect(
        exampleService.createUserServer('admin-only-server', adminServerConfig, testUser)
      ).rejects.toThrow('Permission denied');
    });

    it('should prevent access to non-existent server when adding to group', async () => {
      await expect(
        exampleService.addServerToGroup('test-group-id', 'non-existent-server', testAdmin)
      ).rejects.toThrow('Server non-existent-server not found or not accessible');
    });

    it('should prevent non-admin from updating system config', async () => {
      await expect(
        exampleService.updateSystemConfig({ routing: { enableGlobalRoute: false } }, testUser)
      ).rejects.toThrow('Only admin users can update system configuration');
    });
  });

  describe('DAO Factory', () => {
    it('should provide singleton DAO instances', () => {
      const userDao1 = DaoFactory.getUserDao();
      const userDao2 = DaoFactory.getUserDao();
      
      expect(userDao1).toBe(userDao2); // Should be the same instance
    });

    it('should clear cache properly', () => {
      const userDao1 = DaoFactory.getUserDao();
      DaoFactory.clearCache();
      const userDao2 = DaoFactory.getUserDao();
      
      expect(userDao1).not.toBe(userDao2); // Should be different instances after cache clear
    });

    it('should provide all DAO types', () => {
      const userDao = DaoFactory.getUserDao();
      const serverDao = DaoFactory.getServerDao();
      const groupDao = DaoFactory.getGroupDao();
      const systemConfigDao = DaoFactory.getSystemConfigDao();
      const userConfigDao = DaoFactory.getUserConfigDao();

      expect(userDao).toBeDefined();
      expect(serverDao).toBeDefined();
      expect(groupDao).toBeDefined();
      expect(systemConfigDao).toBeDefined();
      expect(userConfigDao).toBeDefined();
    });
  });
});