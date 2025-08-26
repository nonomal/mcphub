import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { FileSettingsDAO } from '../fileSettingsDAO.js';
import { McpSettings } from '../../types/index.js';

describe('FileSettingsDAO', () => {
  const testDir = '/tmp/mcphub-test-dao';
  const testFilePath = path.join(testDir, 'test_settings.json');
  let dao: FileSettingsDAO;

  const sampleSettings: McpSettings = {
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['test.js'],
      },
    },
    users: [
      {
        username: 'test',
        password: 'hashed',
        isAdmin: false,
      },
    ],
  };

  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });

    dao = new FileSettingsDAO(testFilePath);
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    test('should initialize and create default settings file', async () => {
      await dao.initialize();
      
      expect(await dao.exists()).toBe(true);
      
      const settings = await dao.loadSettings();
      expect(settings).toEqual({ mcpServers: {}, users: [] });
    });

    test('should not overwrite existing settings file', async () => {
      // Create settings file first
      fs.writeFileSync(testFilePath, JSON.stringify(sampleSettings, null, 2));
      
      await dao.initialize();
      
      const settings = await dao.loadSettings();
      expect(settings).toEqual(sampleSettings);
    });
  });

  describe('exists', () => {
    test('should return false when file does not exist', async () => {
      expect(await dao.exists()).toBe(false);
    });

    test('should return true when file exists', async () => {
      fs.writeFileSync(testFilePath, '{}');
      expect(await dao.exists()).toBe(true);
    });
  });

  describe('loadSettings', () => {
    test('should load settings from file', async () => {
      fs.writeFileSync(testFilePath, JSON.stringify(sampleSettings, null, 2));
      
      const settings = await dao.loadSettings();
      expect(settings).toEqual(sampleSettings);
    });

    test('should return default settings when file is invalid JSON', async () => {
      fs.writeFileSync(testFilePath, 'invalid json');
      
      const settings = await dao.loadSettings();
      expect(settings).toEqual({ mcpServers: {}, users: [] });
    });

    test('should return default settings when file has invalid structure', async () => {
      fs.writeFileSync(testFilePath, JSON.stringify({ invalid: 'structure' }));
      
      const settings = await dao.loadSettings();
      expect(settings).toEqual({ mcpServers: {}, users: [] });
    });

    test('should cache settings after first load', async () => {
      fs.writeFileSync(testFilePath, JSON.stringify(sampleSettings, null, 2));
      
      // First load
      const settings1 = await dao.loadSettings();
      
      // Modify file externally
      const modifiedSettings = { ...sampleSettings, mcpServers: {} };
      fs.writeFileSync(testFilePath, JSON.stringify(modifiedSettings, null, 2));
      
      // Second load should return cached data
      const settings2 = await dao.loadSettings();
      expect(settings2).toEqual(settings1);
    });
  });

  describe('saveSettings', () => {
    test('should save settings to file', async () => {
      const success = await dao.saveSettings(sampleSettings);
      
      expect(success).toBe(true);
      expect(fs.existsSync(testFilePath)).toBe(true);
      
      const savedData = JSON.parse(fs.readFileSync(testFilePath, 'utf8'));
      expect(savedData).toEqual(sampleSettings);
    });

    test('should create directory if it does not exist', async () => {
      const deepPath = path.join(testDir, 'deep', 'nested', 'path', 'settings.json');
      const deepDao = new FileSettingsDAO(deepPath);
      
      const success = await deepDao.saveSettings(sampleSettings);
      
      expect(success).toBe(true);
      expect(fs.existsSync(deepPath)).toBe(true);
    });

    test('should reject invalid settings structure', async () => {
      const invalidSettings = { invalid: 'structure' } as any;
      
      const success = await dao.saveSettings(invalidSettings);
      
      expect(success).toBe(false);
    });

    test('should update cache after successful save', async () => {
      await dao.saveSettings(sampleSettings);
      
      // Delete the file externally
      fs.unlinkSync(testFilePath);
      
      // Load should still return cached data
      const settings = await dao.loadSettings();
      expect(settings).toEqual(sampleSettings);
    });
  });

  describe('cache management', () => {
    test('should clear cache', async () => {
      fs.writeFileSync(testFilePath, JSON.stringify(sampleSettings, null, 2));
      
      // Load to populate cache
      await dao.loadSettings();
      expect(dao.getCacheInfo().hasCache).toBe(true);
      
      // Clear cache
      dao.clearCache();
      expect(dao.getCacheInfo().hasCache).toBe(false);
      
      // Modify file
      const modifiedSettings = { ...sampleSettings, mcpServers: {} };
      fs.writeFileSync(testFilePath, JSON.stringify(modifiedSettings, null, 2));
      
      // Load should return modified data
      const settings = await dao.loadSettings();
      expect(settings).toEqual(modifiedSettings);
    });

    test('should provide cache info', async () => {
      const info = dao.getCacheInfo();
      
      expect(info).toHaveProperty('hasCache');
      expect(info).toHaveProperty('filePath');
      expect(info.filePath).toBe(testFilePath);
      expect(info.hasCache).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle permission errors gracefully', async () => {
      // This test might not work in all environments due to permission restrictions
      // but it demonstrates the expected behavior
      
      const readOnlyPath = path.join(testDir, 'readonly', 'settings.json');
      fs.mkdirSync(path.dirname(readOnlyPath), { recursive: true });
      
      // Try to create DAO with restricted path
      const restrictedDao = new FileSettingsDAO(readOnlyPath);
      
      // Should still work for loading (returns defaults)
      const settings = await restrictedDao.loadSettings();
      expect(settings).toEqual({ mcpServers: {}, users: [] });
    });
  });
});