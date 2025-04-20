export interface MCPServerConfig {
  /**
   * Server URL for HTTP/SSE connections
   */
  url: string;
  
  /**
   * Command to execute for StdioTransport (optional)
   */
  command?: string;
  
  /**
   * Command arguments for StdioTransport (optional)
   */
  args?: string[];
  
  /**
   * Additional server configuration (optional)
   */
  [key: string]: any;
}

/**
 * Map of MCP servers configurations
 * Each key represents a unique server identifier
 */
export const mcpServers: Record<string, MCPServerConfig> = {
  // Weather Server configuration
  "weather-server": {
    url: "http://localhost:7001/weatherServer",
    command: "node",
    args: ["./dist/mcpServers/WeatherServer.js"]
  },
  "lianchuang-server": {
    url: "http://localhost:7002/lianchuangServer",
    command: "node",
    args: ["./dist/mcpServers/LianchuangServer.js"]
  }
}; 