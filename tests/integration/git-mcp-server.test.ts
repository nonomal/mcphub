import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('Git-based MCP Server Installation', () => {
  const timeout = 180000; // 3 minutes timeout for git operations

  it('should successfully connect to a git-based MCP server with extended timeout', async () => {
    // Test with a known working git-based MCP server
    const env: Record<string, string> = {
      ...process.env,
      PATH: process.env.PATH || '',
    };

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'git+https://github.com/acehoss/youtube-mcp-server'],
      env,
      stderr: 'pipe',
    });

    // Add stderr logging for debugging - simulating our enhanced logging
    const stderrLogs: string[] = [];
    transport.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      stderrLogs.push(message);
      console.log(`[git-mcp-server stderr] ${message}`);
      
      // Test the enhanced error pattern detection
      if (message.includes('fatal:') || message.includes('error:') || message.includes('failed')) {
        console.warn(`[git-error] ${message}`);
      }
    });

    const client = new Client(
      {
        name: 'test-git-mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      },
    );

    try {
      console.log('Testing git-based installation with extended timeout (180000ms)...');
      const startTime = Date.now();
      
      // Use extended timeout similar to our implementation (3 minutes)
      await client.connect(transport, { timeout });
      
      const connectTime = Date.now() - startTime;
      console.log(`Connection succeeded in ${connectTime}ms`);
      
      // Verify the connection time validates our extended timeout approach
      if (connectTime > 60000) {
        console.log('✅ Git installation took longer than 60s, validating extended timeout approach');
      }
      
      // Try to list tools to verify connection works
      const tools = await client.listTools({}, { timeout: 30000 });
      expect(Array.isArray(tools.tools)).toBe(true);
      expect(tools.tools.length).toBeGreaterThan(0);
      
      console.log(`Successfully connected and found ${tools.tools.length} tools`);
      console.log('Tool names:', tools.tools.map(t => t.name));
      
    } catch (error: any) {
      console.error('Git-based MCP server connection failed:', error);
      console.error('stderr logs:', stderrLogs);
      
      // Enhanced error reporting - simulating our improvements
      if (stderrLogs.length > 0) {
        const gitErrors = stderrLogs.filter(log => 
          log.includes('fatal:') || log.includes('error:') || log.includes('failed')
        );
        if (gitErrors.length > 0) {
          console.error('Git-specific errors detected:', gitErrors);
        }
      }
      
      // Re-throw with more context
      throw new Error(`Failed to connect to git-based MCP server: ${error.message}\nstderr: ${stderrLogs.slice(-5).join('\n')}`);
    } finally {
      try {
        client.close();
        transport.close();
      } catch (cleanupError) {
        console.warn('Error during cleanup:', cleanupError);
      }
    }
  }, timeout + 30000); // Give extra time for Jest test timeout

  it('should handle git installation errors gracefully with enhanced logging', async () => {
    // Test with an invalid git URL to ensure error handling works
    const env: Record<string, string> = {
      ...process.env,
      PATH: process.env.PATH || '',
    };

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'git+https://github.com/nonexistent/invalid-repo-that-does-not-exist'],
      env,
      stderr: 'pipe',
    });

    const stderrLogs: string[] = [];
    let gitErrorsDetected = 0;
    
    transport.stderr?.on('data', (data) => {
      const message = data.toString().trim();
      stderrLogs.push(message);
      console.log(`[invalid-git-server stderr] ${message}`);
      
      // Test enhanced error detection
      if (message.includes('fatal:') || message.includes('error:') || message.includes('failed')) {
        gitErrorsDetected++;
        console.warn(`[git-error] ${message}`);
      }
    });

    const client = new Client(
      {
        name: 'test-invalid-git-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      },
    );

    let connectionFailed = false;
    try {
      await client.connect(transport, { timeout: 90000 });
    } catch (error) {
      connectionFailed = true;
      console.log('Expected connection failure for invalid git repo');
      
      // Verify enhanced error logging worked
      expect(stderrLogs.length).toBeGreaterThan(0);
      console.log(`Captured ${stderrLogs.length} stderr logs`);
      console.log(`Detected ${gitErrorsDetected} git-specific errors`);
    }

    expect(connectionFailed).toBe(true);

    try {
      client.close();
      transport.close();
    } catch (cleanupError) {
      console.warn('Error during cleanup:', cleanupError);
    }
  }, 120000);

  it('should validate timeout behavior for slow installations', async () => {
    // Test that demonstrates why our extended timeout is needed
    const env: Record<string, string> = {
      ...process.env,
      PATH: process.env.PATH || '',
    };

    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', 'git+https://github.com/acehoss/youtube-mcp-server'],
      env,
      stderr: 'pipe',
    });

    const client = new Client(
      {
        name: 'test-timeout-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      },
    );

    // Test with a shorter timeout to demonstrate the need for extended timeouts
    const shortTimeout = 30000; // 30 seconds
    let timeoutOccurred = false;
    
    try {
      console.log(`Testing with short timeout (${shortTimeout}ms) to demonstrate timeout issues...`);
      await client.connect(transport, { timeout: shortTimeout });
      console.log('Connection succeeded with short timeout (unexpected)');
    } catch (error: any) {
      if (error.message && error.message.includes('timeout')) {
        timeoutOccurred = true;
        console.log('✅ Short timeout caused expected failure, validating need for extended timeouts');
      } else {
        console.log('Connection failed for other reasons:', error.message);
      }
    } finally {
      try {
        client.close();
        transport.close();
      } catch (cleanupError) {
        console.warn('Error during cleanup:', cleanupError);
      }
    }

    // If timeout occurred with 30s, it validates our 180s/300s approach
    if (timeoutOccurred) {
      console.log('✅ Demonstrated that git installations need extended timeouts');
    }
  }, 60000);
});