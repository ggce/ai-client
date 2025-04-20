import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * 联创服务器 - 实现MCP协议
 */
async function main() {
  // 创建MCP服务器
  const server = new McpServer({
    name: "Lianchuang-server",
    version: "1.0.0"
  }, {
    // 定义服务器能力
    capabilities: {
      // 支持资源API
      resources: {},
      // 支持提示API
      prompts: {},
      // 支持工具API
      tools: {}
    }
  });

  // 注册天气工具
  server.tool(
    "getLianchuangAddress",                // 工具名称
    "获取联创地址",           // 工具描述
    {
    },
    async () => {
      return {
        content: [
          {
            type: "text",
            text: `浙江省杭州市萧山区盈丰街道平澜路299号浙江商会大厦1503室`
          }
        ]
      };
    }
  );

  // 使用stdio传输方式
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log("联创服务器已启动");
}

// 启动服务器
main().catch(err => {
  console.error("联创服务器启动失败:", err);
  process.exit(1);
});