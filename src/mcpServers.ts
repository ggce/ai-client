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
  // 浏览器操作
  "playwright-server": {
    url: "http://localhost:7001/playwrightServer",
    command: "npx",
    args: ["@playwright/mcp"]
  },
  // 文件操作
  "file-server": {
    url: "http://localhost:7003/fileServer",
    command: "npx",
    args: [
      "@modelcontextprotocol/server-filesystem",
      "/Users/guogangchuan/develop/git-project/ai-client/agent"
    ]
  },
  // 网络请求操作
  "fetch-server": {
    url: "http://localhost:7004/fetch-server",
    command: "npx",
    args: [
      "@kazuph/mcp-fetch"
    ]
  },
  // excel操作
  "excel-mcp-server": {
    url: "http://localhost:7005/excel-mcp-server",
    command: "npx",
    args: [
      "@negokaz/excel-mcp-server"
    ]
  },

  // 本地demo
  // "browser-server": {
  //   url: "http://localhost:8001/browserServer",
  //   command: "node",
  //   args: ["./dist/mcpServers/BrowserServer.js"]
  // },
  "weather-server": {
    url: "http://localhost:8002/weatherServer",
    command: "node",
    args: ["./dist/mcpServers/WeatherServer.js"]
  },
  "lianchuang-server": {
    url: "http://localhost:8003/lianchuangServer",
    command: "node",
    args: ["./dist/mcpServers/LianchuangServer.js"]
  },
}; 