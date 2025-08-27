// Test script to verify naming conflict handling and backward compatibility
// Run this with: npx tsx test-enhanced-schema.ts

import { OpenAPIClient } from './src/clients/openapi.js';
import type { ServerConfig } from './src/types/index.js';

async function testEnhancedSchema() {
  console.log('🧪 Testing Enhanced Schema Parsing...\n');

  // Test 1: Schema with naming conflicts
  console.log('1️⃣ Testing naming conflict handling...');
  
  const conflictSchema = {
    openapi: '3.0.3',
    info: {
      title: 'Conflict Test API',
      version: '1.0.0',
    },
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/api/users/{name}': {
        post: {
          operationId: 'createUserWithNameConflict',
          summary: 'Create user with naming conflict',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Path parameter name'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'email'],
                  properties: {
                    name: {
                      type: 'string',
                      description: 'Body parameter name'
                    },
                    email: {
                      type: 'string',
                      description: 'User email'
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': { description: 'Success' }
          }
        }
      }
    }
  };

  const conflictConfig: ServerConfig = {
    type: 'openapi',
    openapi: { schema: conflictSchema }
  };

  const conflictClient = new OpenAPIClient(conflictConfig);
  await conflictClient.initialize();
  const conflictTools = conflictClient.getTools();

  console.log(`   Found ${conflictTools.length} tools:`);
  conflictTools.forEach((tool) => {
    console.log(`   Tool: ${tool.name}`);
    const properties = tool.inputSchema.properties as Record<string, any>;
    console.log(`   Properties: ${Object.keys(properties).join(', ')}`);
    Object.entries(properties).forEach(([propName, propSchema]) => {
      console.log(`     - ${propName}: ${propSchema.description || 'No description'}`);
    });
    console.log('');
  });

  // Test 2: Non-object request body (should fallback)
  console.log('2️⃣ Testing non-object request body fallback...');
  
  const arraySchema = {
    openapi: '3.0.3',
    info: {
      title: 'Array Test API',
      version: '1.0.0',
    },
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/api/bulk-users': {
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
          responses: {
            '200': { description: 'Success' }
          }
        }
      }
    }
  };

  const arrayConfig: ServerConfig = {
    type: 'openapi',
    openapi: { schema: arraySchema }
  };

  const arrayClient = new OpenAPIClient(arrayConfig);
  await arrayClient.initialize();
  const arrayTools = arrayClient.getTools();

  console.log(`   Found ${arrayTools.length} tools:`);
  arrayTools.forEach((tool) => {
    console.log(`   Tool: ${tool.name}`);
    const properties = tool.inputSchema.properties as Record<string, any>;
    console.log(`   Properties: ${Object.keys(properties).join(', ')}`);
    Object.entries(properties).forEach(([propName, propSchema]) => {
      if (propName === 'body') {
        console.log(`     - ${propName}: Array schema (fallback behavior)`);
      } else {
        console.log(`     - ${propName}: ${propSchema.description || 'No description'}`);
      }
    });
    console.log('');
  });

  // Test 3: Original behavior with URL-based configuration (backward compatibility)
  console.log('3️⃣ Testing backward compatibility...');
  
  const basicSchema = {
    openapi: '3.0.3',
    info: { title: 'Basic API', version: '1.0.0' },
    servers: [{ url: 'https://api.example.com' }],
    paths: {
      '/simple': {
        get: {
          operationId: 'getSimple',
          summary: 'Simple GET endpoint',
          parameters: [
            {
              name: 'query1',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { description: 'Success' }
          }
        }
      }
    }
  };

  const basicConfig: ServerConfig = {
    type: 'openapi',
    openapi: { schema: basicSchema }
  };

  const basicClient = new OpenAPIClient(basicConfig);
  await basicClient.initialize();
  const basicTools = basicClient.getTools();

  console.log(`   Found ${basicTools.length} tools:`);
  basicTools.forEach((tool) => {
    console.log(`   Tool: ${tool.name}`);
    const properties = tool.inputSchema.properties as Record<string, any>;
    console.log(`   Properties: ${Object.keys(properties).join(', ')}`);
    console.log('');
  });

  console.log('✅ All enhanced schema tests completed successfully!');
}

// Run the test
testEnhancedSchema().catch(console.error);