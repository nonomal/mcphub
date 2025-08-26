import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { initRoutes } from '../../src/routes/index.js';
import { initUpstreamServers } from '../../src/services/mcpService.js';

/**
 * Integration test for OpenAPI endpoints with real MCP server
 * This test uses the actual configuration and tests end-to-end functionality
 */
describe('OpenAPI Endpoints Integration Test', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Initialize routes
    initRoutes(app);

    // Start server on a test port
    server = createServer(app);
    
    // Initialize upstream servers (if any are configured)
    try {
      await initUpstreamServers();
    } catch (error) {
      console.log('No upstream servers configured for test, continuing...');
    }
  }, 30000);

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  describe('OpenAPI Tool Discovery', () => {
    it('should list all available tools with OpenAPI endpoints', async () => {
      const response = await request(app)
        .get('/api/tools/openapi')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.objectContaining({
          tools: expect.any(Array),
          totalCount: expect.any(Number),
        }),
      });

      // Log the available tools for debugging
      console.log('Available tools:', response.body.data.tools.length);
      if (response.body.data.tools.length > 0) {
        console.log('First tool:', response.body.data.tools[0]);
      }
    });

    it('should handle empty tools list gracefully', async () => {
      const response = await request(app)
        .get('/api/tools/openapi')
        .expect(200);

      expect(response.body.data.tools).toBeInstanceOf(Array);
      expect(response.body.data.totalCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('OpenAPI Schema Generation', () => {
    it('should return 404 for non-existent server/tool combination', async () => {
      const response = await request(app)
        .get('/openapi/non-existent-server/non-existent-tool/openapi.json')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found'),
      });
    });

    it('should validate OpenAPI schema structure when tools exist', async () => {
      // First get the list of available tools
      const toolsResponse = await request(app)
        .get('/api/tools/openapi')
        .expect(200);

      const tools = toolsResponse.body.data.tools;
      
      if (tools.length > 0) {
        const firstTool = tools[0];
        const { serverName, toolName } = firstTool;

        const schemaResponse = await request(app)
          .get(`/openapi/${serverName}/${toolName}/openapi.json`)
          .expect(200);

        // Validate OpenAPI schema structure
        expect(schemaResponse.body).toMatchObject({
          openapi: '3.1.0',
          info: expect.objectContaining({
            title: expect.any(String),
            description: expect.any(String),
            version: '1.0.0',
          }),
          servers: expect.arrayContaining([
            expect.objectContaining({
              url: expect.any(String),
            }),
          ]),
          paths: expect.objectContaining({
            [`/api/tools/${serverName}/${toolName}`]: expect.objectContaining({
              post: expect.objectContaining({
                operationId: expect.any(String),
                summary: expect.any(String),
                description: expect.any(String),
                requestBody: expect.any(Object),
                responses: expect.any(Object),
              }),
            }),
          }),
        });

        console.log(`Verified OpenAPI schema for tool: ${serverName}/${toolName}`);
      } else {
        console.log('No tools available to test schema generation');
      }
    });
  });

  describe('Direct Tool Execution', () => {
    it('should return 404 for non-existent server/tool execution', async () => {
      const response = await request(app)
        .post('/api/tools/non-existent-server/non-existent-tool')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.stringContaining('not found'),
      });
    });

    it('should validate tool execution endpoint when tools exist', async () => {
      // First get the list of available tools
      const toolsResponse = await request(app)
        .get('/api/tools/openapi')
        .expect(200);

      const tools = toolsResponse.body.data.tools;
      
      if (tools.length > 0) {
        const firstTool = tools[0];
        const { serverName, toolName } = firstTool;

        // Try to execute the tool with empty arguments
        // This might fail due to missing required arguments, but should not return 404
        const execResponse = await request(app)
          .post(`/api/tools/${serverName}/${toolName}`)
          .send({});

        // Should not be 404 (tool exists), but might be 400 or 500 depending on tool requirements
        expect(execResponse.status).not.toBe(404);
        
        if (execResponse.status === 200) {
          expect(execResponse.body).toMatchObject({
            success: true,
            data: expect.objectContaining({
              content: expect.any(Array),
              toolName: expect.any(String),
              arguments: expect.any(Object),
            }),
          });
        }

        console.log(`Tested tool execution for: ${serverName}/${toolName}, status: ${execResponse.status}`);
      } else {
        console.log('No tools available to test execution');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing parameters gracefully', async () => {
      const response = await request(app)
        .get('/openapi//tool/openapi.json') // Missing server name
        .expect(404);

      // Should handle the malformed URL gracefully
    });

    it('should return consistent error format', async () => {
      const response = await request(app)
        .get('/openapi/test/test/openapi.json')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: expect.any(String),
      });
    });
  });
});