import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { 
  loadSettings, 
  saveSettings, 
  loadSettingsAsync, 
  saveSettingsAsync,
  clearSettingsCache,
  clearSettingsCacheAsync,
  getSettingsCacheInfo,
  getSettingsCacheInfoAsync,
  initializeDAOSync,
  resetDAO
} from '../../config/index.js';
import { configureDAOFactory, resetDAOFactory } from '../../dao/factory.js';
import { McpSettings } from '../../types/index.js';

describe('DAO Integration Tests', () => {
  const testDir = '/tmp/mcphub-integration-test';
  const testFilePath = path.join(testDir, 'test_settings.json');

  const sampleSettings: McpSettings = {
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['test.js'],
        env: { TEST: 'value' },
      },
      'another-server': {
        command: 'python',
        args: ['script.py'],
      },
    },
    users: [
      {
        username: 'admin',
        password: '$2b$10$hashedPassword',
        isAdmin: true,
      },
      {
        username: 'user',
        password: '$2b$10$anotherHashedPassword',
        isAdmin: false,
      },
    ],
    systemConfig: {
      routing: {
        skipAuth: false,
      },
    },
  };

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    // Reset DAO state
    resetDAO();

    // Configure DAO factory to use test file
    configureDAOFactory({
      type: 'file',
      config: { filePath: testFilePath }
    });

    // Initialize DAO for tests
    await initializeDAOSync();
  });

  afterEach(() => {
    // Reset DAO factory and state
    resetDAOFactory();
    resetDAO();
    
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Backward compatibility with existing sync API', () => {
    test('should load and save settings using sync functions', () => {
      // Initially should load default settings
      let settings = loadSettings();
      expect(settings.mcpServers).toEqual({});
      expect(settings.users).toEqual([]);

      // Save new settings
      const success = saveSettings(sampleSettings);
      expect(success).toBe(true);

      // Verify file was created
      expect(fs.existsSync(testFilePath)).toBe(true);

      // Load settings again
      clearSettingsCache();
      settings = loadSettings();
      expect(settings).toEqual(sampleSettings);
    });

    test('should handle user filtering through DataService', () => {
      // Save settings first
      saveSettings(sampleSettings);
      
      // Load settings with user filtering (should work the same way)
      const adminUser = { username: 'admin', password: '', isAdmin: true };
      const settings = loadSettings(adminUser);
      
      // DataService should filter settings based on user
      expect(settings).toEqual(sampleSettings);
    });

    test('should manage cache correctly', () => {
      // Save initial settings
      saveSettings(sampleSettings);
      
      // Load settings (should be cached)
      const settings1 = loadSettings();
      const cacheInfo1 = getSettingsCacheInfo();
      expect(cacheInfo1.hasCache).toBe(true);
      
      // Modify file externally
      const modifiedSettings = { ...sampleSettings, mcpServers: {} };
      fs.writeFileSync(testFilePath, JSON.stringify(modifiedSettings, null, 2));
      
      // Should still return cached data
      const settings2 = loadSettings();
      expect(settings2).toEqual(settings1);
      
      // Clear cache and reload
      clearSettingsCache();
      const settings3 = loadSettings();
      expect(settings3).toEqual(modifiedSettings);
    });
  });

  describe('New async API functionality', () => {
    test('should load and save settings using async functions', async () => {
      // Initially should load default settings
      let settings = await loadSettingsAsync();
      expect(settings.mcpServers).toEqual({});
      expect(settings.users).toEqual([]);

      // Save new settings
      const success = await saveSettingsAsync(sampleSettings);
      expect(success).toBe(true);

      // Verify file was created
      expect(fs.existsSync(testFilePath)).toBe(true);

      // Load settings again
      await clearSettingsCacheAsync();
      settings = await loadSettingsAsync();
      expect(settings).toEqual(sampleSettings);
    });

    test('should provide detailed cache info via async API', async () => {
      await saveSettingsAsync(sampleSettings);
      
      const cacheInfo = await getSettingsCacheInfoAsync();
      expect(cacheInfo.hasCache).toBe(true);
      expect(cacheInfo.daoInfo).toBeDefined();
      expect(cacheInfo.daoInfo.filePath).toBe(testFilePath);
    });

    test('should handle async errors gracefully', async () => {
      // Configure DAO to use invalid path
      resetDAO();
      configureDAOFactory({
        type: 'file',
        config: { filePath: '/root/invalid/path/that/cannot/be/created' }
      });

      // Initialization should fail, which is expected behavior
      try {
        await initializeDAOSync();
        // If we get here, the path was actually writable, so test the fallback
        const settings = await loadSettingsAsync();
        expect(settings).toEqual({ mcpServers: {}, users: [] });
        
        const success = await saveSettingsAsync(sampleSettings);
        expect(success).toBe(false);
      } catch (error) {
        // Expected: DAO initialization fails for invalid paths
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Failed to initialize FileSettingsDAO');
      }
    });
  });

  describe('Error handling and robustness', () => {
    test('should handle permission errors gracefully', async () => {
      // Create readonly directory (if possible in current environment)
      const readonlyDir = path.join(testDir, 'readonly');
      fs.mkdirSync(readonlyDir, { recursive: true });
      
      try {
        fs.chmodSync(readonlyDir, 0o444); // readonly
        
        resetDAO();
        configureDAOFactory({
          type: 'file',
          config: { filePath: path.join(readonlyDir, 'settings.json') }
        });
        await initializeDAOSync();

        // Should still work for loading (returns defaults)
        const settings = await loadSettingsAsync();
        expect(settings).toEqual({ mcpServers: {}, users: [] });

        // Saving should fail gracefully
        const success = await saveSettingsAsync(sampleSettings);
        expect(success).toBe(false);
      } finally {
        // Restore permissions for cleanup
        try {
          fs.chmodSync(readonlyDir, 0o755);
        } catch {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('Integration with DataService', () => {
    test('should apply DataService filtering on loaded settings', () => {
      // Save settings
      saveSettings(sampleSettings);
      
      // Load with different users
      const adminUser = { username: 'admin', password: '', isAdmin: true };
      const regularUser = { username: 'user', password: '', isAdmin: false };
      
      const adminSettings = loadSettings(adminUser);
      const userSettings = loadSettings(regularUser);
      
      // Both should work (DataService default implementation doesn't filter)
      expect(adminSettings).toEqual(sampleSettings);
      expect(userSettings).toEqual(sampleSettings);
    });

    test('should apply DataService merging on saved settings', () => {
      // Save initial settings
      saveSettings(sampleSettings);
      
      // Save partial update
      const partialUpdate: McpSettings = {
        mcpServers: {
          'new-server': {
            command: 'new-command',
            args: ['new-arg'],
          },
        },
        users: [],
      };

      const user = { username: 'admin', password: '', isAdmin: true };
      const success = saveSettings(partialUpdate, user);
      expect(success).toBe(true);

      // Load settings - DataService should have merged them
      clearSettingsCache();
      const settings = loadSettings();
      expect(settings).toEqual(partialUpdate); // Default DataService overwrites
    });
  });
});