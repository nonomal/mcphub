// Unit tests for enhanced OpenAPI schema parsing
import { OpenAPIClient } from '../../src/clients/openapi.js';
import type { ServerConfig } from '../../src/types/index.js';

describe('OpenAPI Client - Enhanced Schema Parsing', () => {
  describe('Request Body Flattening', () => {
    it('should flatten object request body to individual fields', async () => {
      const schema = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users': {
            post: {
              operationId: 'createUser',
              summary: 'Create user',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'email'],
                      properties: {
                        name: { type: 'string', description: 'User name' },
                        email: { type: 'string', format: 'email', description: 'User email' },
                        age: { type: 'integer', description: 'User age' }
                      }
                    }
                  }
                }
              },
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const config: ServerConfig = {
        type: 'openapi',
        openapi: { schema }
      };

      const client = new OpenAPIClient(config);
      await client.initialize();
      const tools = client.getTools();

      expect(tools).toHaveLength(1);
      
      const tool = tools[0];
      expect(tool.name).toBe('createUser');
      
      const properties = tool.inputSchema.properties as Record<string, any>;
      expect(Object.keys(properties)).toEqual(['name', 'email', 'age']);
      expect(properties.name.description).toBe('User name');
      expect(properties.email.description).toBe('User email');
      expect(properties.age.description).toBe('User age');
      
      const required = tool.inputSchema.required as string[];
      expect(required).toEqual(['name', 'email']);
    });

    it('should handle naming conflicts by prefixing body fields', async () => {
      const schema = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users/{name}': {
            put: {
              operationId: 'updateUser',
              summary: 'Update user',
              parameters: [
                {
                  name: 'name',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' },
                  description: 'Path parameter'
                }
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name'],
                      properties: {
                        name: { type: 'string', description: 'Body parameter' },
                        email: { type: 'string', description: 'User email' }
                      }
                    }
                  }
                }
              },
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const config: ServerConfig = {
        type: 'openapi',
        openapi: { schema }
      };

      const client = new OpenAPIClient(config);
      await client.initialize();
      const tools = client.getTools();

      expect(tools).toHaveLength(1);
      
      const tool = tools[0];
      const properties = tool.inputSchema.properties as Record<string, any>;
      
      expect(Object.keys(properties)).toEqual(['name', 'body_name', 'email']);
      expect(properties.name.description).toBe('Path parameter');
      expect(properties.body_name.description).toBe('Body parameter');
      expect(properties.email.description).toBe('User email');
      
      const required = tool.inputSchema.required as string[];
      expect(required).toEqual(['name', 'body_name']);
    });

    it('should fallback to body field for non-object request bodies', async () => {
      const schema = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/bulk-users': {
            post: {
              operationId: 'createBulkUsers',
              summary: 'Create multiple users',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          email: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              },
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const config: ServerConfig = {
        type: 'openapi',
        openapi: { schema }
      };

      const client = new OpenAPIClient(config);
      await client.initialize();
      const tools = client.getTools();

      expect(tools).toHaveLength(1);
      
      const tool = tools[0];
      const properties = tool.inputSchema.properties as Record<string, any>;
      
      expect(Object.keys(properties)).toEqual(['body']);
      expect(properties.body.type).toBe('array');
      
      const required = tool.inputSchema.required as string[];
      expect(required).toEqual(['body']);
    });

    it('should preserve existing behavior for endpoints without request bodies', async () => {
      const schema = {
        openapi: '3.0.3',
        info: { title: 'Test API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get users',
              parameters: [
                {
                  name: 'limit',
                  in: 'query',
                  schema: { type: 'integer' }
                }
              ],
              responses: { '200': { description: 'Success' } }
            }
          }
        }
      };

      const config: ServerConfig = {
        type: 'openapi',
        openapi: { schema }
      };

      const client = new OpenAPIClient(config);
      await client.initialize();
      const tools = client.getTools();

      expect(tools).toHaveLength(1);
      
      const tool = tools[0];
      const properties = tool.inputSchema.properties as Record<string, any>;
      
      expect(Object.keys(properties)).toEqual(['limit']);
      expect(properties.limit.type).toBe('integer');
      
      const required = tool.inputSchema.required as string[];
      expect(required).toEqual([]);
    });
  });

  describe('SpringDoc Compatibility', () => {
    it('should handle complex SpringDoc-like schemas with nested objects', async () => {
      const springDocSchema = {
        openapi: '3.0.3',
        info: { title: 'SpringDoc API', version: '1.0.0' },
        servers: [{ url: 'https://api.example.com' }],
        paths: {
          '/api/users': {
            post: {
              operationId: 'createUser',
              summary: 'Create user',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/UserCreateRequest'
                    }
                  }
                }
              },
              responses: { '200': { description: 'Success' } }
            }
          }
        },
        components: {
          schemas: {
            UserCreateRequest: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: { type: 'string', description: 'User full name' },
                email: { type: 'string', format: 'email', description: 'User email' },
                addresses: {
                  type: 'array',
                  description: 'User addresses',
                  items: { $ref: '#/components/schemas/Address' }
                }
              }
            },
            Address: {
              type: 'object',
              required: ['street', 'city'],
              properties: {
                street: { type: 'string', description: 'Street address' },
                city: { type: 'string', description: 'City' }
              }
            }
          }
        }
      };

      const config: ServerConfig = {
        type: 'openapi',
        openapi: { schema: springDocSchema }
      };

      const client = new OpenAPIClient(config);
      await client.initialize();
      const tools = client.getTools();

      expect(tools).toHaveLength(1);
      
      const tool = tools[0];
      const properties = tool.inputSchema.properties as Record<string, any>;
      
      expect(Object.keys(properties)).toEqual(['name', 'email', 'addresses']);
      expect(properties.name.description).toBe('User full name');
      expect(properties.email.description).toBe('User email');
      expect(properties.addresses.description).toBe('User addresses');
      expect(properties.addresses.type).toBe('array');
      
      const required = tool.inputSchema.required as string[];
      expect(required).toEqual(['name', 'email']);
    });
  });
});