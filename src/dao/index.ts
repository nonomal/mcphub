/**
 * DAO (Data Access Object) module for MCPHub
 * 
 * This module provides an abstraction layer for data persistence operations,
 * allowing the application to work with different storage backends (file, database, etc.)
 * without changing the business logic.
 */

export type { SettingsDAO, DAOFactory, DAOConfig } from './interfaces.js';
export { FileSettingsDAO } from './fileSettingsDAO.js';
export { 
  DefaultDAOFactory, 
  getDAOFactory, 
  setDAOFactory, 
  configureDAOFactory, 
  resetDAOFactory 
} from './factory.js';