import request from 'supertest';
import express from 'express';
import { initRoutes } from '../../src/routes/index.js';
import * as mcpService from '../../src/services/mcpService.js';

// Mock the mcpService
jest.mock('../../src/services/mcpService.js');

describe('OpenAPI Tool Controller', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    initRoutes(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /openapi/:serverName/:toolName/openapi.json', () => {
    it('should return OpenAPI schema for a valid tool', async () => {
      // Mock server info with a tool
      const mockServersInfo = [
        {
          name: 'test-server',
          tools: [
            {
              name: 'test-server-get_time',
              description: 'Get current time',
              enabled: true,
              inputSchema: {
                type: 'object',
                properties: {
                  format: {
                    type: 'string',
                    description: 'Time format',
                  },
                },
              },
            },
          ],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);

      const response = await request(app)
        .get('/openapi/test-server/get_time/openapi.json')
        .expect(200);

      expect(response.body).toMatchObject({
        openapi: '3.1.0',
        info: {
          title: 'get_time Tool API',
          description: 'Get current time',
          version: '1.0.0',
        },
        paths: {
          '/api/tools/test-server/get_time': {
            post: {
              operationId: 'call_get_time',
              summary: 'Call get_time tool',
              description: 'Get current time',
            },
          },
        },
      });
    });

    it('should return 404 for non-existent server', async () => {
      (mcpService.getServersInfo as jest.Mock).mockReturnValue([]);

      const response = await request(app)
        .get('/openapi/non-existent/tool/openapi.json')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Server 'non-existent' not found",
      });
    });

    it('should return 404 for non-existent tool', async () => {
      const mockServersInfo = [
        {
          name: 'test-server',
          tools: [],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);

      const response = await request(app)
        .get('/openapi/test-server/non-existent/openapi.json')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Tool 'non-existent' not found in server 'test-server'",
      });
    });

    it('should return 404 for disabled tool', async () => {
      const mockServersInfo = [
        {
          name: 'test-server',
          tools: [
            {
              name: 'test-server-disabled_tool',
              description: 'A disabled tool',
              enabled: false,
              inputSchema: {},
            },
          ],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);

      const response = await request(app)
        .get('/openapi/test-server/disabled_tool/openapi.json')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Tool 'disabled_tool' is disabled",
      });
    });
  });

  describe('POST /api/tools/:serverName/:toolName', () => {
    it('should execute a tool successfully', async () => {
      const mockServersInfo = [
        {
          name: 'test-server',
          tools: [
            {
              name: 'test-server-get_time',
              description: 'Get current time',
              enabled: true,
              inputSchema: {
                type: 'object',
                properties: {
                  format: {
                    type: 'string',
                  },
                },
              },
            },
          ],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      const mockResult = {
        content: [
          {
            type: 'text',
            text: '2023-10-01 12:00:00',
          },
        ],
      };

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);
      (mcpService.handleCallToolRequest as jest.Mock).mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/tools/test-server/get_time')
        .send({ format: 'YYYY-MM-DD HH:mm:ss' })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          content: [
            {
              type: 'text',
              text: '2023-10-01 12:00:00',
            },
          ],
          toolName: 'test-server-get_time',
          arguments: { format: 'YYYY-MM-DD HH:mm:ss' },
        },
      });
    });

    it('should return 404 for non-existent server', async () => {
      (mcpService.getServersInfo as jest.Mock).mockReturnValue([]);

      const response = await request(app)
        .post('/api/tools/non-existent/tool')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Server 'non-existent' not found",
      });
    });

    it('should return 404 for non-existent tool', async () => {
      const mockServersInfo = [
        {
          name: 'test-server',
          tools: [],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);

      const response = await request(app)
        .post('/api/tools/test-server/non-existent')
        .send({})
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: "Tool 'non-existent' not found in server 'test-server'",
      });
    });
  });

  describe('GET /api/tools/openapi', () => {
    it('should list all available tools with OpenAPI endpoints', async () => {
      const mockServersInfo = [
        {
          name: 'server1',
          tools: [
            {
              name: 'server1-tool1',
              description: 'Tool 1',
              enabled: true,
              inputSchema: {},
            },
            {
              name: 'server1-tool2',
              description: 'Tool 2',
              enabled: false, // disabled tool should be filtered out
              inputSchema: {},
            },
          ],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
        {
          name: 'server2',
          tools: [
            {
              name: 'server2-tool3',
              description: 'Tool 3',
              enabled: true,
              inputSchema: {},
            },
          ],
          status: 'connected',
          error: null,
          prompts: [],
          createTime: Date.now(),
        },
      ];

      (mcpService.getServersInfo as jest.Mock).mockReturnValue(mockServersInfo);

      const response = await request(app)
        .get('/api/tools/openapi')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          tools: [
            {
              serverName: 'server1',
              toolName: 'tool1',
              originalToolName: 'server1-tool1',
              description: 'Tool 1',
              endpoint: '/api/tools/server1/tool1',
              openApiSchema: '/openapi/server1/tool1/openapi.json',
            },
            {
              serverName: 'server2',
              toolName: 'tool3',
              originalToolName: 'server2-tool3',
              description: 'Tool 3',
              endpoint: '/api/tools/server2/tool3',
              openApiSchema: '/openapi/server2/tool3/openapi.json',
            },
          ],
          totalCount: 2,
        },
      });
    });
  });
});