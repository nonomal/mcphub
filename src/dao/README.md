# DAO Layer Implementation

This directory contains the Data Access Object (DAO) layer implementation for MCPHub. The DAO layer provides a clean abstraction for data access operations, making it easy to switch between different storage backends (currently JSON file-based, with future support for databases).

## Architecture

### Base Classes

- **`BaseDao<T, K>`**: Interface defining standard CRUD operations
- **`FileBasedDao<T, K>`**: Abstract base class for file-based implementations

### Specific DAOs

- **`UserDao`**: Manages user data (IUser)
- **`ServerDao`**: Manages server configurations (ServerConfig)
- **`GroupDao`**: Manages server groups (IGroup)
- **`SystemConfigDao`**: Manages system-wide configuration (SystemConfig)
- **`UserConfigDao`**: Manages user-specific configurations (UserConfig)

### Factory Pattern

- **`DaoFactory`**: Provides singleton instances of all DAOs

## Usage Examples

### Basic DAO Operations

```typescript
import { DaoFactory } from './dao/index.js';

// Get DAO instances
const userDao = DaoFactory.getUserDao();
const serverDao = DaoFactory.getServerDao();

// Create a new user (admin only)
const newUser = await userDao.create({
  username: 'newuser',
  password: 'hashedPassword',
  isAdmin: false
}, adminUser);

// Create a new server
const serverConfig = await serverDao.createWithName('my-server', {
  command: 'node',
  args: ['server.js'],
  owner: 'newuser',
  enabled: true
}, user);

// Find servers by owner
const userServers = await serverDao.getServersByOwner('newuser', adminUser);
```

### Permission-Based Access

The DAO layer implements comprehensive permission controls:

```typescript
// Admin users can access everything
const allUsers = await userDao.findAll(adminUser);

// Regular users can only see their own data
const myData = await userDao.findAll(regularUser); // Only returns the user's own record

// Users can update admin servers but cannot delete them
await serverDao.update('admin-server', { enabled: false }, regularUser); // ✅ Allowed
await serverDao.delete('admin-server', regularUser); // ❌ Throws permission error
```

### High-Level Service Integration

Use the `ExampleDaoUsageService` for complex operations:

```typescript
import { ExampleDaoUsageService } from './services/exampleDaoUsage.js';

const service = new ExampleDaoUsageService();

// Get comprehensive dashboard data
const dashboard = await service.getDashboardData(user);

// Create and link resources
const server = await service.createUserServer('new-server', config, user);
await service.addServerToGroup('group-id', 'new-server', user);
```

## Permission Model

### User Permissions

- **Admin users**: Full access to all data types
- **Regular users**: 
  - Can read/write their own data
  - Can read admin-owned servers and groups
  - Can update admin-owned servers (but not delete them)
  - Cannot access other users' private data

### Data Ownership

- Each data type can have an `owner` field
- Default owner is 'admin' if not specified
- Users can manage resources they own
- Admin resources are generally readable by all users

## Testing

Comprehensive test coverage includes:

- Unit tests for each DAO (`src/dao/__tests__/*Dao.test.ts`)
- Integration tests (`src/dao/__tests__/integration.test.ts`)
- Permission validation tests
- Cross-DAO operation tests

```bash
# Run all DAO tests
npm test -- src/dao/__tests__

# Run specific DAO tests
npm test -- src/dao/__tests__/userDao.test.ts
```

## Future Database Support

The DAO layer is designed to easily support database backends. To add database support:

1. Create new DAO implementations (e.g., `DatabaseUserDao`)
2. Implement the same `BaseDao<T, K>` interface
3. Update `DaoFactory` to use database DAOs
4. No changes needed in service layer code

Example structure for database support:

```typescript
export class DatabaseUserDao implements BaseDao<IUser, string> {
  constructor(private dbConnection: DatabaseConnection) {}
  
  async findAll(user?: IUser): Promise<IUser[]> {
    // Database query implementation
  }
  
  // ... other methods
}
```

## Migration Guide

### From Direct Config Access

**Before:**
```typescript
import { loadSettings, saveSettings } from './config/index.js';

const settings = loadSettings(user);
settings.users.push(newUser);
saveSettings(settings, user);
```

**After:**
```typescript
import { DaoFactory } from './dao/index.js';

const userDao = DaoFactory.getUserDao();
await userDao.create(newUser, user);
```

### From DataService

**Before:**
```typescript
const dataService = getDataService();
const filteredSettings = dataService.filterSettings(settings, user);
```

**After:**
```typescript
// Use specific DAOs for better type safety and performance
const userDao = DaoFactory.getUserDao();
const serverDao = DaoFactory.getServerDao();

const users = await userDao.findAll(user);
const servers = await serverDao.findAll(user);
```

## Best Practices

1. **Use DAOs directly** for simple CRUD operations
2. **Use service classes** for complex business logic involving multiple DAOs
3. **Always pass user context** for proper permission filtering
4. **Handle errors gracefully** - DAOs throw descriptive errors for permission violations
5. **Use factory pattern** to get DAO instances for consistency
6. **Write tests** that mock the config layer for isolated testing

## Configuration Integration

The DAO layer integrates with the existing configuration system:

- `loadOriginalSettings()`: Raw data access (used internally by DAOs)
- `loadSettingsWithDao()`: Permission-filtered data access
- `saveSettingsWithDao()`: Permission-validated data saving

For new code, prefer using DAOs directly over the config functions for better type safety and permission handling.