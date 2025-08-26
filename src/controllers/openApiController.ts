import { Request, Response } from 'express';
import { ApiResponse, Tool } from '../types/index.js';
import { getServersInfo, handleCallToolRequest } from '../services/mcpService.js';

/**
 * OpenAPI Tool Controller
 * Provides OpenAPI-compatible endpoints for MCP tools
 */

/**
 * Generate OpenAPI schema for a specific tool
 */
const generateToolOpenAPISchema = (serverName: string, tool: Tool) => {
  // Remove server prefix from tool name for cleaner API
  const cleanToolName = tool.name.replace(`${serverName}-`, '');
  
  const schema = {
    openapi: '3.1.0',
    info: {
      title: `${cleanToolName} Tool API`,
      description: tool.description,
      version: '1.0.0',
    },
    servers: [
      {
        url: process.env.BASE_URL || 'http://localhost:3000',
        description: 'MCPHub Tool API Server',
      },
    ],
    paths: {
      [`/api/tools/${serverName}/${cleanToolName}`]: {
        post: {
          operationId: `call_${cleanToolName}`,
          summary: `Call ${cleanToolName} tool`,
          description: tool.description,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: tool.inputSchema,
              },
            },
          },
          responses: {
            '200': {
              description: 'Successful tool execution',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                      },
                      data: {
                        type: 'object',
                        properties: {
                          content: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                type: {
                                  type: 'string',
                                },
                                text: {
                                  type: 'string',
                                },
                              },
                            },
                          },
                          toolName: {
                            type: 'string',
                          },
                          arguments: {
                            type: 'object',
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            '400': {
              description: 'Bad request - invalid input',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false,
                      },
                      message: {
                        type: 'string',
                      },
                      error: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
            '500': {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      success: {
                        type: 'boolean',
                        example: false,
                      },
                      message: {
                        type: 'string',
                      },
                      error: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return schema;
};

/**
 * Get OpenAPI schema for a specific tool
 * Route: GET /openapi/{serverName}/{toolName}/openapi.json
 */
export const getToolOpenAPISchema = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverName, toolName } = req.params;
    
    if (!serverName || !toolName) {
      res.status(400).json({
        success: false,
        message: 'Server name and tool name are required',
      });
      return;
    }

    // Get all servers info
    const serversInfo = getServersInfo();
    
    // Find the server
    const server = serversInfo.find(s => s.name === serverName);
    if (!server) {
      res.status(404).json({
        success: false,
        message: `Server '${serverName}' not found`,
      });
      return;
    }

    // Find the tool - look for both prefixed and unprefixed names
    const prefixedToolName = `${serverName}-${toolName}`;
    const tool = server.tools.find(t => 
      t.name === toolName || 
      t.name === prefixedToolName ||
      t.name.replace(`${serverName}-`, '') === toolName
    );
    
    if (!tool) {
      res.status(404).json({
        success: false,
        message: `Tool '${toolName}' not found in server '${serverName}'`,
      });
      return;
    }

    // Check if tool is enabled
    if (tool.enabled === false) {
      res.status(404).json({
        success: false,
        message: `Tool '${toolName}' is disabled`,
      });
      return;
    }

    const schema = generateToolOpenAPISchema(serverName, tool);
    
    res.json(schema);
  } catch (error) {
    console.error('Error generating OpenAPI schema:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OpenAPI schema',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * Execute a specific tool
 * Route: POST /api/tools/{serverName}/{toolName}
 */
export const executeToolDirect = async (req: Request, res: Response): Promise<void> => {
  try {
    const { serverName, toolName } = req.params;
    const toolArgs = req.body || {};

    if (!serverName || !toolName) {
      res.status(400).json({
        success: false,
        message: 'Server name and tool name are required',
      });
      return;
    }

    // Get all servers info to validate server and tool
    const serversInfo = getServersInfo();
    
    // Find the server
    const server = serversInfo.find(s => s.name === serverName);
    if (!server) {
      res.status(404).json({
        success: false,
        message: `Server '${serverName}' not found`,
      });
      return;
    }

    // Find the tool - look for both prefixed and unprefixed names
    const prefixedToolName = `${serverName}-${toolName}`;
    const tool = server.tools.find(t => 
      t.name === toolName || 
      t.name === prefixedToolName ||
      t.name.replace(`${serverName}-`, '') === toolName
    );
    
    if (!tool) {
      res.status(404).json({
        success: false,
        message: `Tool '${toolName}' not found in server '${serverName}'`,
      });
      return;
    }

    // Check if tool is enabled
    if (tool.enabled === false) {
      res.status(403).json({
        success: false,
        message: `Tool '${toolName}' is disabled`,
      });
      return;
    }

    // Create a mock request structure for handleCallToolRequest
    const mockRequest = {
      params: {
        name: 'call_tool',
        arguments: {
          toolName: tool.name, // Use the full tool name as found
          arguments: toolArgs,
        },
      },
    };

    const extra = {
      sessionId: req.headers['x-session-id'] || 'openapi-session',
      server: serverName,
    };

    const result = await handleCallToolRequest(mockRequest, extra);

    const response: ApiResponse = {
      success: true,
      data: {
        content: result.content || [],
        toolName: tool.name,
        arguments: toolArgs,
      },
    };

    res.json(response);
  } catch (error) {
    console.error(`Error executing tool ${req.params.toolName}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute tool',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};

/**
 * List all available tools with their OpenAPI endpoints
 * Route: GET /api/tools/openapi
 */
export const listToolsOpenAPI = async (req: Request, res: Response): Promise<void> => {
  try {
    const serversInfo = getServersInfo();
    
    const toolsInfo = serversInfo.flatMap(server => 
      server.tools
        .filter(tool => tool.enabled !== false)
        .map(tool => {
          const cleanToolName = tool.name.replace(`${server.name}-`, '');
          return {
            serverName: server.name,
            toolName: cleanToolName,
            originalToolName: tool.name,
            description: tool.description,
            endpoint: `/api/tools/${server.name}/${cleanToolName}`,
            openApiSchema: `/openapi/${server.name}/${cleanToolName}/openapi.json`,
          };
        })
    );

    const response: ApiResponse = {
      success: true,
      data: {
        tools: toolsInfo,
        totalCount: toolsInfo.length,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error listing tools:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list tools',
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};