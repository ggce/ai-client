import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 浏览器服务器 - 实现MCP协议
 */
async function main() {
  // 创建MCP服务器
  const server = new McpServer({
    name: "browser-server",
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

  // 注册打开浏览器工具
  server.tool(
    "openBrowser",              // 工具名称
    "打开浏览器访问指定URL",     // 工具描述
    {
      url: z.string().url().describe("要访问的URL地址")
    },
    async ({ url }) => {
      console.log(`收到打开浏览器请求，URL: ${url}`);
      
      try {
        // 根据操作系统打开浏览器
        let command;
        const platform = process.platform;
        
        if (platform === 'darwin') {  // macOS
          command = `open "${url}"`;
        } else if (platform === 'win32') {  // Windows
          command = `start "" "${url}"`;
        } else {  // Linux
          command = `xdg-open "${url}"`;
        }
        
        await execAsync(command);
        
        return {
          content: [
            {
              type: "text",
              text: `已成功打开浏览器访问: ${url}`
            }
          ]
        };
      } catch (error: any) {
        console.error("打开浏览器失败:", error);
        return {
          content: [
            {
              type: "text",
              text: `打开浏览器失败: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // 使用stdio传输方式
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log("浏览器服务器已启动");
}

// 启动服务器
main().catch(err => {
  console.error("浏览器服务器启动失败:", err);
  process.exit(1);
}); 