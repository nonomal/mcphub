import { GroupDao } from '../groupDao.js';
import { IUser, IGroup, IGroupServerConfig } from '../../types/index.js';

// Mock the config module
jest.mock('../../config/index.js', () => ({
  loadOriginalSettings: jest.fn(),
  saveSettings: jest.fn(),
}));

import { loadOriginalSettings, saveSettings } from '../../config/index.js';

describe('GroupDao', () => {
  let groupDao: GroupDao;
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

  const adminGroup: IGroup = {
    id: 'admin-group-id',
    name: 'Admin Group',
    description: 'Admin owned group',
    servers: ['server1', 'server2'],
    owner: 'admin',
  };

  const userGroup: IGroup = {
    id: 'user-group-id',
    name: 'User Group',
    description: 'User owned group',
    servers: [{ name: 'server3', tools: ['tool1', 'tool2'] }],
    owner: 'user1',
  };

  beforeEach(() => {
    groupDao = new GroupDao();
    mockLoadSettings = loadOriginalSettings as jest.MockedFunction<typeof loadOriginalSettings>;
    mockSaveSettings = saveSettings as jest.MockedFunction<typeof saveSettings>;
    
    // Create a fresh copy of mock settings for each test
    mockLoadSettings.mockReturnValue({
      mcpServers: {},
      users: [],
      groups: [{ ...adminGroup }, { ...userGroup }],
    });
    mockSaveSettings.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all groups for admin', async () => {
      const groups = await groupDao.findAll(testAdmin);
      expect(groups).toHaveLength(2);
      expect(groups).toContainEqual(expect.objectContaining({ name: 'Admin Group' }));
      expect(groups).toContainEqual(expect.objectContaining({ name: 'User Group' }));
    });

    it('should return only accessible groups for non-admin', async () => {
      const groups = await groupDao.findAll(testUser);
      expect(groups).toHaveLength(2); // Both admin and user1 groups are accessible
    });

    it('should return empty array for no user', async () => {
      const groups = await groupDao.findAll();
      expect(groups).toHaveLength(0);
    });
  });

  describe('findByKey', () => {
    it('should return group by id for admin', async () => {
      const group = await groupDao.findByKey('admin-group-id', testAdmin);
      expect(group).toEqual(expect.objectContaining({ name: 'Admin Group' }));
    });

    it('should return admin-owned group for non-admin', async () => {
      const group = await groupDao.findByKey('admin-group-id', testUser);
      expect(group).toEqual(expect.objectContaining({ name: 'Admin Group' }));
    });

    it('should return own group for non-admin', async () => {
      const group = await groupDao.findByKey('user-group-id', testUser);
      expect(group).toEqual(expect.objectContaining({ name: 'User Group' }));
    });
  });

  describe('create', () => {
    const newGroup: IGroup = {
      id: 'new-group-id',
      name: 'New Group',
      description: 'A new group',
      servers: ['server4'],
      owner: 'user1',
    };

    it('should allow admin to create any group', async () => {
      const created = await groupDao.create(newGroup, testAdmin);
      expect(created).toEqual(newGroup);
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          groups: expect.arrayContaining([newGroup]),
        })
      );
    });

    it('should allow user to create own group', async () => {
      const created = await groupDao.create(newGroup, testUser);
      expect(created).toEqual(newGroup);
    });

    it('should not allow user to create admin-owned group', async () => {
      const adminOwnedGroup: IGroup = {
        ...newGroup,
        owner: 'admin',
      };

      await expect(
        groupDao.create(adminOwnedGroup, testUser)
      ).rejects.toThrow('Permission denied: Cannot create item');
    });

    it('should not allow duplicate group ids', async () => {
      const duplicateGroup: IGroup = {
        ...newGroup,
        id: 'admin-group-id', // Already exists
      };

      await expect(groupDao.create(duplicateGroup, testAdmin)).rejects.toThrow(
        'Item with key admin-group-id already exists'
      );
    });
  });

  describe('update', () => {
    it('should allow admin to update any group', async () => {
      const updates = { description: 'Updated description' };
      const updated = await groupDao.update('admin-group-id', updates, testAdmin);
      
      expect(updated).toEqual(expect.objectContaining(updates));
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to update own group', async () => {
      const updates = { description: 'Updated by user' };
      const updated = await groupDao.update('user-group-id', updates, testUser);
      
      expect(updated).toEqual(expect.objectContaining(updates));
    });

    it('should not allow user to update admin-owned group', async () => {
      const updates = { description: 'Should fail' };
      await expect(groupDao.update('admin-group-id', updates, testUser)).rejects.toThrow(
        'Permission denied: Cannot update item'
      );
    });
  });

  describe('delete', () => {
    it('should allow admin to delete any group', async () => {
      const deleted = await groupDao.delete('user-group-id', testAdmin);
      expect(deleted).toBe(true);
      expect(mockSaveSettings).toHaveBeenCalled();
    });

    it('should allow user to delete own group', async () => {
      const deleted = await groupDao.delete('user-group-id', testUser);
      expect(deleted).toBe(true);
    });

    it('should not allow user to delete admin-owned group', async () => {
      await expect(groupDao.delete('admin-group-id', testUser)).rejects.toThrow(
        'Permission denied: Cannot delete item'
      );
    });
  });

  describe('convenience methods', () => {
    it('should find group by name', async () => {
      const group = await groupDao.findByName('Admin Group', testAdmin);
      expect(group).toEqual(expect.objectContaining({ name: 'Admin Group' }));
    });

    it('should check if group name exists', async () => {
      const exists = await groupDao.nameExists('Admin Group');
      expect(exists).toBe(true);

      const notExists = await groupDao.nameExists('Nonexistent Group');
      expect(notExists).toBe(false);
    });

    it('should check if group id exists', async () => {
      const exists = await groupDao.idExists('admin-group-id');
      expect(exists).toBe(true);

      const notExists = await groupDao.idExists('nonexistent-id');
      expect(notExists).toBe(false);
    });

    it('should get groups by owner', async () => {
      const userGroups = await groupDao.getGroupsByOwner('user1', testAdmin);
      expect(userGroups).toHaveLength(1);
      expect(userGroups[0]).toEqual(expect.objectContaining({ name: 'User Group' }));
    });

    it('should get groups containing server', async () => {
      const groups = await groupDao.getGroupsContainingServer('server1', testAdmin);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(expect.objectContaining({ name: 'Admin Group' }));
    });

    it('should add server to group', async () => {
      const updated = await groupDao.addServerToGroup('admin-group-id', 'new-server', testAdmin);
      expect(updated?.servers).toContain('new-server');
    });

    it('should remove server from group', async () => {
      const updated = await groupDao.removeServerFromGroup('admin-group-id', 'server1', testAdmin);
      expect(updated?.servers).not.toContain('server1');
    });

    it('should update group servers', async () => {
      const newServers: string[] = ['new-server1', 'new-server2'];
      const updated = await groupDao.updateGroupServers('admin-group-id', newServers, testAdmin);
      expect(updated?.servers).toEqual(newServers);
    });
  });
});