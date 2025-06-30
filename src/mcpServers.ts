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

// mcp server type map
export enum MCPServerTypeMap {
  browser = "浏览器",
  file = "文件",
  code = "代码",
  search = "搜索",
  analysis = "数据分析", 
  tools = "其他工具",
  demo = "demo",
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
    type: "browser",
    description: "浏览器自动化工具",
    args: ["@playwright/mcp"]
  },
  // 文件操作
  "file-server": {
    url: "http://localhost:7002/fileServer",
    command: "npx",
    type: "file",
    description: "本地文件操作",
    args: [
      "@modelcontextprotocol/server-filesystem",
      "/Users/guogangchuan/develop/git-project/ai-client/agent"
    ]
  },
  // 命令行
  "desktop-commander-server": {
    url: "http://localhost:7003/fileServer",
    "command": "npx",
    type: "code",
    description: "命令行操作",
    "args": [
      "@wonderwhy-er/desktop-commander"
    ]
  },
  // python代码执行
  "python-interpreter-server": {
    url: "http://localhost:7013/pythonInterpreterServer",
    "command": "mcp-python-interpreter",
    type: "code",
    description: "python代码执行",
    "args": [
      "--dir",
      "/Users/guogangchuan/develop/git-project/ai-client/agent"
    ],
    "env": {
      "MCP_ALLOW_SYSTEM_ACCESS": 0,
      "PATH": process.env.PATH
    }
  },
  // 智谱-网络搜索
  "zhipu-web-search-server": {
    url: "https://open.bigmodel.cn/api/mcp/web_search/sse?Authorization=a811e37196c84bf59709a7aceb7f7433.smfEWjixOBmNuqDC",
    type: "search",
    description: "智谱-网络搜索",
  },
  // 图表生成
  "antv-chart-server": {
    url: "http://localhost:7014/antvChartServer",
    "command": "npx",
    type: "analysis",
    description: "图表生成",
    "args": [
      "@antv/mcp-server-chart"
    ]
  },
  // 中文热搜
  "cn-hot-news-server": {
    url: "http://localhost:7015/cnHotNewsServer",
    "command": "npx",
    type: "search",
    description: "中文热搜",
    "args": [
      "@wopal/mcp-server-hotnews"
    ]
  },
  "yunxiao-server": {
    url: "http://localhost:7016/yunxiaoServer",
    "command": "npx",
    type: "code",
    description: "云效",
    "args": [
      "alibabacloud-devops-mcp-server"
    ],
    "env": {
      "YUNXIAO_ACCESS_TOKEN": "pt-rrCbvDOfrz6sSnGapndTc89M_5988ed6d-36be-419a-af90-67f5eb9e7005",
      "PATH": process.env.PATH
    }
  },
  // 网络请求操作
  "firecrawl-server": {
    url: "http://localhost:7010/firecrawlServer",
    command: "npx",
    type: "search",
    description: "网络请求操作（爬虫）",
    args: [
      "firecrawl-mcp"
    ],
    env: {
      "FIRECRAWL_API_KEY": "c31fedf4-a502-4b2f-b013-3ed102c5463d",
      "PATH": process.env.PATH
    }
  },
  // 网络请求操作
  "fetch-server": {
    url: "http://localhost:7004/fetch-server",
    command: "npx",
    type: "search",
    description: "网络请求操作（fetch）",
    args: [
      "@kazuph/mcp-fetch"
    ]
  },
  // excel操作
  "excel-mcp-server": {
    url: "http://localhost:7005/excel-mcp-server",
    type: "file",
    description: "excel操作",
    command: "npx",
    args: [
      "@negokaz/excel-mcp-server"
    ]
  },
  // 通过结构化思维过程提供了一种动态和反思性的问题解决工具
  "sequential-thinking-server": {
    url: "http://localhost:7006/sequentialThinkingServer",
    command: "npx",
    type: "tools",
    description: "通过结构化思维过程提供了一种动态和反思性的问题解决工具",
    args: ["@modelcontextprotocol/server-sequential-thinking"]
  },
  // 通过 tavily-search 工具实现实时网络搜索功能 通过 tavily-extract 工具从网页中智能提取数据
  "tavily-search-server": {
    url: "http://localhost:7007/tavilySearchServer",
    command: "npx",
    type: "search",
    description: "通过 tavily-search 工具实现实时网络搜索功能 通过 tavily-extract 工具从网页中智能提取数据",
    args: [
      "tavily-mcp@0.1.4"
    ],
    env: {
      "TAVILY_API_KEY": "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",
      "PATH": process.env.PATH
    }
  },
  // 各格式文件转markitdown
  "markitdown-server": {
    url: "http://localhost:7011/markitdownServer",
    command: "markitdown-mcp",
    type: "file",
    description: "各格式文件转markitdown",
    args: [],
  },
  // 浏览器自动化
  "puppeteer-server": {
    url: "http://localhost:7012/puppeteerServer",
    command: "npx",
    type: "browser",
    description: "浏览器自动化",
    args: [
      '@modelcontextprotocol/server-puppeteer'
    ],
    // "env": {
    //   "PUPPETEER_LAUNCH_OPTIONS": "{ \"headless\": false}",
    //   "PATH": process.env.PATH
    // }
  },
  // 百度地图
  "baidu-map-server": {
    url: "http://localhost:7008/baiduMapServer",
    "command": "npx",
    type: "tools",
    description: "百度地图",
    "args": [
      "@baidumap/mcp-server-baidu-map"
    ],
    "env": {
      "BAIDU_MAP_API_KEY": "uyTr6pO6US94ws6yz0tZSXSJ7X4wkyLT",
      "PATH": process.env.PATH
    }
  },
  // 百度搜索
  "baidu-search-server": {
    "url": "http://appbuilder.baidu.com/v2/ai_search/mcp/sse?api_key=Bearer+bce-v3/ALTAK-XrGNJfcENgbHK6Mraj5Yt/3e55298a8b0ddf1a0e56253a1eb3ada499d5225b",
    type: "search",
    description: "百度搜索"
  },
  // 当前时间
  "time-server": {
    url: "http://localhost:7009/timeServer",
    "command": "python",
    type: "tools",
    description: "获取当前时间",
    "args": ["-m", "mcp_server_time", "--local-timezone=Asia/Shanghai"]
  },
  // 本地demo
  // "browser-server": {
  //   url: "http://localhost:8001/browserServer",
  //   command: "node",
  //   args: ["./dist/mcpServers/BrowserServer.js"]
  // },
  // demo，天气
  "(demo-for-test)_weather-server": {
    url: "http://localhost:8002/weatherServer",
    command: "node",
    type: "demo",
    description: "demo-获取天气",
    args: ["./dist/mcpServers/WeatherServer.js"]
  },
  // demo，联创信息
  "(demo-for-test)_lianchuang-server": {
    url: "http://localhost:8003/lianchuangServer",
    command: "node",
    type: "demo",
    description: "demo-联创信息",
    args: ["./dist/mcpServers/LianchuangServer.js"]
  },
}; 