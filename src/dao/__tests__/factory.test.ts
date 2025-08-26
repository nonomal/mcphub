import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { 
  DefaultDAOFactory, 
  getDAOFactory, 
  setDAOFactory, 
  configureDAOFactory,
  resetDAOFactory 
} from '../factory.js';
import { FileSettingsDAO } from '../fileSettingsDAO.js';
import type { SettingsDAO, DAOFactory } from '../interfaces.js';

describe('DAO Factory', () => {
  afterEach(() => {
    resetDAOFactory();
  });

  describe('DefaultDAOFactory', () => {
    test('should create file-based DAO by default', async () => {
      const factory = new DefaultDAOFactory();
      const dao = await factory.createSettingsDAO();
      
      expect(dao).toBeInstanceOf(FileSettingsDAO);
    });

    test('should create file-based DAO with custom path', async () => {
      const factory = new DefaultDAOFactory({
        type: 'file',
        config: { filePath: '/tmp/test-custom.json' }
      });
      const dao = await factory.createSettingsDAO();
      
      expect(dao).toBeInstanceOf(FileSettingsDAO);
      expect((dao as FileSettingsDAO).getFilePath()).toBe('/tmp/test-custom.json');
    });

    test('should throw error for unsupported DAO types', async () => {
      const factory = new DefaultDAOFactory({ type: 'database' } as any);
      
      await expect(factory.createSettingsDAO()).rejects.toThrow('Database DAO not implemented yet');
    });

    test('should throw error for unknown DAO types', async () => {
      const factory = new DefaultDAOFactory({ type: 'unknown' } as any);
      
      await expect(factory.createSettingsDAO()).rejects.toThrow('Unsupported DAO type: unknown');
    });
  });

  describe('Global factory management', () => {
    test('should return default factory when none is set', () => {
      const factory = getDAOFactory();
      expect(factory).toBeInstanceOf(DefaultDAOFactory);
    });

    test('should allow setting custom factory', () => {
      const customFactory: DAOFactory = {
        async createSettingsDAO(): Promise<SettingsDAO> {
          throw new Error('Custom factory');
        }
      };

      setDAOFactory(customFactory);
      const factory = getDAOFactory();
      
      expect(factory).toBe(customFactory);
    });

    test('should configure factory with specific settings', async () => {
      configureDAOFactory({
        type: 'file',
        config: { filePath: '/tmp/configured.json' }
      });

      const factory = getDAOFactory();
      const dao = await factory.createSettingsDAO();
      
      expect(dao).toBeInstanceOf(FileSettingsDAO);
      expect((dao as FileSettingsDAO).getFilePath()).toBe('/tmp/configured.json');
    });

    test('should reset to default factory', () => {
      const customFactory: DAOFactory = {
        async createSettingsDAO(): Promise<SettingsDAO> {
          throw new Error('Custom factory');
        }
      };

      setDAOFactory(customFactory);
      expect(getDAOFactory()).toBe(customFactory);

      resetDAOFactory();
      expect(getDAOFactory()).toBeInstanceOf(DefaultDAOFactory);
    });

    test('should return same instance on multiple calls', () => {
      const factory1 = getDAOFactory();
      const factory2 = getDAOFactory();
      
      expect(factory1).toBe(factory2);
    });
  });
});