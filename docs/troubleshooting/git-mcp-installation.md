# Git-based MCP Server Installation Fix

This document explains the improvements made to handle git-based MCP server installations that were causing `-32000` errors.

## Problem Analysis

The issue was that git-based installations using `npx git+https://...` URLs were failing with `-32000` errors due to:

1. **Insufficient timeouts**: Git installations can take 20-60+ seconds, but default timeouts were only 60 seconds
2. **Poor error handling**: Limited context for debugging NPX/git failures
3. **No special handling**: Git installations have different characteristics than regular npm packages

## Solution Implemented

### 1. Enhanced Git Detection
```typescript
const isGitBasedInstallation = (command: string, args: string[]): boolean => {
  if (command === 'npx' || command === 'npm' || command === 'yarn' || command === 'pnpm') {
    return args.some(arg => arg.startsWith('git+') || arg.includes('github.com') || arg.includes('gitlab.com'));
  }
  return false;
};
```

### 2. Extended Timeouts for Git Installations
- **Regular installations**: 60 seconds (unchanged)
- **Git-based installations**: 300 seconds (5 minutes)
- **Init timeout**: Properly uses configured `initTimeout` value (300 seconds default)

### 3. Enhanced Error Handling and Logging
```typescript
// Enhanced stderr logging for better debugging
const stderrLogs: string[] = [];
transport.stderr?.on('data', (data) => {
  const message = data.toString().trim();
  stderrLogs.push(message);
  console.log(`[${name}] [stderr] ${message}`);
  
  // Log important error patterns for git-based installations
  if (isGitBased && (message.includes('fatal:') || message.includes('error:') || message.includes('failed'))) {
    console.warn(`[${name}] [git-error] ${message}`);
  }
});
```

### 4. Retry Mechanism for Git Installations
- Git-based installations get 1 retry attempt (2 total attempts)
- 2-second delay between retry attempts
- Enhanced error messages include installation logs

### 5. Git Availability Validation
```typescript
const validateGitAvailability = async (name: string): Promise<void> => {
  try {
    const { execSync } = await import('child_process');
    execSync('git --version', { timeout: 5000, stdio: 'pipe' });
    console.log(`[${name}] Git is available for installation`);
  } catch (error) {
    throw new Error(`Git is required for git-based installations but is not available.`);
  }
};
```

## Testing Results

Our integration tests show:
- ✅ Git installations complete successfully (3.4-22+ seconds depending on network)
- ✅ Tools are properly discovered (7 tools found in YouTube MCP server)
- ✅ Enhanced error logging provides better debugging information
- ✅ Extended timeouts prevent premature failures

## Configuration Example

To use a git-based MCP server, add to `mcp_settings.json`:

```json
{
  "mcpServers": {
    "youtube-git-server": {
      "command": "npx",
      "args": ["-y", "git+https://github.com/acehoss/youtube-mcp-server"],
      "env": {},
      "enabled": true
    }
  }
}
```

The system will automatically:
1. Detect this as a git-based installation
2. Apply extended 5-minute timeout
3. Validate git availability
4. Provide enhanced error logging
5. Retry once if initial attempt fails

## Troubleshooting

If you still experience issues:

1. **Check git availability**: Ensure `git --version` works
2. **Network connectivity**: Verify access to the git repository
3. **Check logs**: Look for `[git-error]` messages in the console
4. **Repository validity**: Ensure the git repository contains a valid MCP server
5. **NPM registry**: Check if custom npm registries are configured properly

## Benefits

- 🔧 **Fixes -32000 errors** for git-based installations
- ⏱️ **Prevents timeout failures** with appropriate timeouts
- 🔍 **Better debugging** with enhanced error logging
- 🔄 **Reliability** with retry mechanism
- ✅ **Validation** ensures git is available before attempting installation