// Test script to verify tool calling with flattened fields
// Run this with: npx tsx test-tool-calling.ts

import { OpenAPIClient } from './src/clients/openapi.js';
import type { ServerConfig } from './src/types/index.js';

async function testToolCalling() {
  console.log('🧪 Testing Tool Calling with Flattened Fields...\n');

  // Mock HTTP client to capture requests
  let capturedRequest: any = null;
  
  const mockSchema = {
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
                    email: { type: 'string', description: 'User email' },
                    age: { type: 'integer', description: 'User age' }
                  }
                }
              }
            }
          },
          responses: { '200': { description: 'Success', content: { 'application/json': { schema: { type: 'object' } } } } }
        }
      },
      '/users/{id}': {
        put: {
          operationId: 'updateUser',
          summary: 'Update user',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            },
            {
              name: 'version',
              in: 'query',
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'User ID in body (conflict test)' },
                    name: { type: 'string', description: 'User name' }
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
    openapi: { schema: mockSchema }
  };

  const client = new OpenAPIClient(config);
  
  // Mock the HTTP client request method
  (client as any).httpClient.request = async (requestConfig: any) => {
    capturedRequest = requestConfig;
    return { data: { success: true, message: 'Mocked response' } };
  };

  await client.initialize();
  const tools = client.getTools();

  console.log(`Found ${tools.length} tools:`);
  tools.forEach((tool, index) => {
    console.log(`${index + 1}. ${tool.name}: ${tool.description}`);
    const properties = tool.inputSchema.properties as Record<string, any>;
    console.log(`   Parameters: ${Object.keys(properties).join(', ')}`);
  });

  // Test 1: Call tool with flattened fields (no conflicts)
  console.log('\n1️⃣ Testing tool call with flattened fields...');
  try {
    const result = await client.callTool('createUser', {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    });

    console.log('✅ Tool call successful');
    console.log('📝 Captured request data:', JSON.stringify(capturedRequest.data, null, 2));
    console.log('📍 Expected reconstructed body: { name: "John Doe", email: "john@example.com", age: 30 }');
    
    // Verify the request body was correctly reconstructed
    const expectedBody = { name: 'John Doe', email: 'john@example.com', age: 30 };
    if (JSON.stringify(capturedRequest.data) === JSON.stringify(expectedBody)) {
      console.log('✅ Request body correctly reconstructed');
    } else {
      console.log('❌ Request body reconstruction failed');
    }
  } catch (error) {
    console.error('❌ Tool call failed:', error);
  }

  // Test 2: Call tool with naming conflicts
  console.log('\n2️⃣ Testing tool call with naming conflicts...');
  try {
    const result = await client.callTool('updateUser', {
      id: 'user123',           // Path parameter
      version: 'v1',           // Query parameter
      body_id: 'body-user123', // Body parameter (renamed due to conflict)
      name: 'Jane Doe'         // Body parameter (no conflict)
    });

    console.log('✅ Tool call successful');
    console.log('📝 Captured request:', {
      url: capturedRequest.url,
      params: capturedRequest.params,
      data: capturedRequest.data
    });
    console.log('📍 Expected URL: /users/user123');
    console.log('📍 Expected query params: { version: "v1" }');
    console.log('📍 Expected body: { id: "body-user123", name: "Jane Doe" }');
    
    // Verify URL replacement
    if (capturedRequest.url === '/users/user123') {
      console.log('✅ Path parameter correctly substituted');
    } else {
      console.log('❌ Path parameter substitution failed');
    }

    // Verify query parameters
    if (JSON.stringify(capturedRequest.params) === JSON.stringify({ version: 'v1' })) {
      console.log('✅ Query parameters correctly set');
    } else {
      console.log('❌ Query parameters failed');
    }

    // Verify request body
    const expectedBody = { id: 'body-user123', name: 'Jane Doe' };
    if (JSON.stringify(capturedRequest.data) === JSON.stringify(expectedBody)) {
      console.log('✅ Request body with conflicts correctly reconstructed');
    } else {
      console.log('❌ Request body reconstruction with conflicts failed');
    }
  } catch (error) {
    console.error('❌ Tool call failed:', error);
  }

  console.log('\n🎉 Tool calling tests completed!');
}

// Run the test
testToolCalling().catch(console.error);