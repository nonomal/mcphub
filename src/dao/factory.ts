import { SettingsDAO, DAOFactory, DAOConfig } from './interfaces.js';
import { FileSettingsDAO } from './fileSettingsDAO.js';

/**
 * Default DAO factory implementation
 * Creates appropriate DAO instances based on configuration
 */
export class DefaultDAOFactory implements DAOFactory {
  private config: DAOConfig;

  constructor(config?: DAOConfig) {
    this.config = config || { type: 'file' };
  }

  async createSettingsDAO(): Promise<SettingsDAO> {
    switch (this.config.type) {
      case 'file':
        const filePath = this.config.config?.filePath;
        const fileDAO = new FileSettingsDAO(filePath);
        await fileDAO.initialize();
        return fileDAO;

      case 'database':
        // TODO: Implement database DAO
        throw new Error('Database DAO not implemented yet');

      case 'memory':
        // TODO: Implement memory DAO for testing
        throw new Error('Memory DAO not implemented yet');

      default:
        throw new Error(`Unsupported DAO type: ${this.config.type}`);
    }
  }
}

/**
 * Global DAO factory instance
 */
let daoFactory: DAOFactory | null = null;

/**
 * Get the global DAO factory instance
 */
export function getDAOFactory(): DAOFactory {
  if (!daoFactory) {
    // Default to file-based DAO
    daoFactory = new DefaultDAOFactory();
  }
  return daoFactory;
}

/**
 * Set a custom DAO factory (useful for testing or custom implementations)
 */
export function setDAOFactory(factory: DAOFactory): void {
  daoFactory = factory;
}

/**
 * Configure the DAO factory with specific settings
 */
export function configureDAOFactory(config: DAOConfig): void {
  daoFactory = new DefaultDAOFactory(config);
}

/**
 * Reset the DAO factory to default (primarily for testing)
 */
export function resetDAOFactory(): void {
  daoFactory = null;
}