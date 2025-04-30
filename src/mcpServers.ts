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
    url: "http://localhost:7002/fileServer",
    command: "npx",
    args: [
      "@modelcontextprotocol/server-filesystem",
      "/Users/guogangchuan/develop/git-project/ai-client/agent"
    ]
  },
  // 网络请求操作
  "fetch-server": {
    url: "http://localhost:7003/fetch-server",
    command: "npx",
    args: [
      "@kazuph/mcp-fetch"
    ]
  },
  // excel操作
  "excel-mcp-server": {
    url: "http://localhost:7004/excel-mcp-server",
    command: "npx",
    args: [
      "@negokaz/excel-mcp-server"
    ]
  },
  // 通过结构化思维过程提供了一种动态和反思性的问题解决工具
  "sequential-thinking-server": {
    url: "http://localhost:7005/sequentialThinkingServer",
    command: "npx",
    args: ["@modelcontextprotocol/server-sequential-thinking"]
  },
  // 通过 tavily-search 工具实现实时网络搜索功能 通过 tavily-extract 工具从网页中智能提取数据
  "tavily-search-server": {
    url: "http://localhost:7006/tavilySearchServer",
    command: "npx",
    args: [
      "tavily-mcp@0.1.4"
    ],
    env: {
      "TAVILY_API_KEY": "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",
      "PATH": process.env.PATH
    }
  },
  // 百度地图
  "baidu-map-server": {
    url: "http://localhost:7007/baiduMapServer",
    "command": "npx",
    "args": [
      "@baidumap/mcp-server-baidu-map"
    ],
    "env": {
      "BAIDU_MAP_API_KEY": "uyTr6pO6US94ws6yz0tZSXSJ7X4wkyLT",
      "PATH": process.env.PATH
    }
  },
  "baidu-search-server": {
    "url": "http://appbuilder.baidu.com/v2/ai_search/mcp/sse?api_key=Bearer+bce-v3/ALTAK-XrGNJfcENgbHK6Mraj5Yt/3e55298a8b0ddf1a0e56253a1eb3ada499d5225b"
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