// Test script to reproduce SpringDoc schema parsing issue
// Run this with: npx tsx test-springdoc-schema.ts

import { OpenAPIClient } from './src/clients/openapi.js';
import type { ServerConfig } from './src/types/index.js';

async function testSpringDocSchema() {
  console.log('🧪 Testing SpringDoc-like Schema Parsing...\n');

  // This mimics a typical SpringDoc v3/api-docs structure
  const springDocSchema = {
    openapi: '3.0.3',
    info: {
      title: 'SpringDoc API',
      version: '1.0.0',
    },
    servers: [
      {
        url: 'https://api.example.com',
      },
    ],
    paths: {
      '/api/users': {
        post: {
          operationId: 'createUser',
          summary: 'Create a new user',
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
          responses: {
            '200': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          }
        }
      },
      '/api/users/{id}': {
        put: {
          operationId: 'updateUser',
          summary: 'Update user',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer', format: 'int64' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserUpdateRequest'
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'User updated successfully'
            }
          }
        }
      }
    },
    components: {
      schemas: {
        UserCreateRequest: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: {
              type: 'string',
              description: 'User full name',
              minLength: 1,
              maxLength: 100
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            age: {
              type: 'integer',
              minimum: 18,
              maximum: 120,
              description: 'User age (optional)'
            },
            addresses: {
              type: 'array',
              description: 'List of user addresses',
              items: {
                $ref: '#/components/schemas/Address'
              }
            },
            preferences: {
              $ref: '#/components/schemas/UserPreferences'
            }
          }
        },
        UserUpdateRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'User full name'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            age: {
              type: 'integer',
              minimum: 18,
              maximum: 120
            }
          }
        },
        Address: {
          type: 'object',
          required: ['street', 'city'],
          properties: {
            street: {
              type: 'string',
              description: 'Street address'
            },
            city: {
              type: 'string',
              description: 'City name'
            },
            country: {
              type: 'string',
              description: 'Country code',
              pattern: '^[A-Z]{2}$'
            },
            zipCode: {
              type: 'string',
              description: 'Postal code'
            }
          }
        },
        UserPreferences: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              enum: ['light', 'dark'],
              description: 'UI theme preference'
            },
            notifications: {
              type: 'boolean',
              description: 'Enable notifications'
            },
            language: {
              type: 'string',
              description: 'Preferred language code'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              format: 'int64'
            },
            name: {
              type: 'string'
            },
            email: {
              type: 'string'
            }
          }
        }
      }
    }
  };

  try {
    const config: ServerConfig = {
      type: 'openapi',
      openapi: {
        schema: springDocSchema,
        version: '3.0.3'
      },
    };

    console.log('   Creating OpenAPI client with SpringDoc-like schema...');
    const client = new OpenAPIClient(config);

    console.log('   Initializing client...');
    await client.initialize();

    console.log('   Getting available tools...');
    const tools = client.getTools();

    console.log(`   ✅ Schema parsed successfully!`);
    console.log(`   📋 Found ${tools.length} tools:\n`);

    tools.forEach((tool, index) => {
      console.log(`   ${index + 1}. Tool: ${tool.name}`);
      console.log(`      Description: ${tool.description}`);
      console.log(`      Method: ${tool.method.toUpperCase()} ${tool.path}`);
      
      // Show the input schema structure
      console.log(`      Input Schema:`);
      console.log(`        Type: ${tool.inputSchema.type}`);
      
      const properties = tool.inputSchema.properties as Record<string, any>;
      if (properties && Object.keys(properties).length > 0) {
        console.log(`        Properties:`);
        Object.entries(properties).forEach(([propName, propSchema]) => {
          console.log(`          - ${propName}: ${JSON.stringify(propSchema, null, 4)}`);
        });
      } else {
        console.log(`        Properties: None`);
      }
      
      const required = tool.inputSchema.required as string[];
      if (required && required.length > 0) {
        console.log(`        Required: [${required.join(', ')}]`);
      }
      
      console.log(''); // Empty line for spacing
    });

    console.log('\n🔍 Analysis:');
    console.log('   The issue should be visible in how request body schemas are handled.');
    console.log('   Instead of showing individual fields like "name", "email", "age", etc.,');
    console.log('   the current implementation likely shows just "body" with the entire schema.');

  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    console.error('   Stack trace:', (error as Error).stack);
  }
}

// Run the test
testSpringDocSchema().catch(console.error);