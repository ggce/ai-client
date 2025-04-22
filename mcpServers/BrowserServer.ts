import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * 浏览器服务器 - 实现MCP协议
 * 提供打开浏览器功能
 */
async function main() {
  // 创建MCP服务器
  const server = new McpServer({
    name: "browser-server",
    version: "1.0.0"
  }, {
    // 定义服务器能力
    capabilities: {
      tools: {}  // 支持工具API
    }
  });

  // 注册打开浏览器工具
  server.tool(
    "openBrowser",             // 工具名称
    "打开浏览器访问指定URL",    // 工具描述
    {
      url: z.string().url().describe("要访问的URL地址"),
      browser: z.enum(["default", "chrome", "firefox", "safari"]).optional().default("default").describe("浏览器类型")
    },
    async ({ url, browser }) => {
      console.log(`收到打开浏览器请求，URL: ${url}, 浏览器: ${browser}`);
      
      try {
        let command = "";
        const platform = process.platform;
        
        // 根据不同平台和浏览器类型构建命令
        if (platform === "darwin") {  // macOS
          if (browser === "chrome") {
            command = `open -a "Google Chrome" "${url}"`;
          } else if (browser === "firefox") {
            command = `open -a "Firefox" "${url}"`;
          } else if (browser === "safari") {
            command = `open -a "Safari" "${url}"`;
          } else {
            command = `open "${url}"`;
          }
        } else if (platform === "win32") {  // Windows
          if (browser === "chrome") {
            command = `start chrome "${url}"`;
          } else if (browser === "firefox") {
            command = `start firefox "${url}"`;
          } else if (browser === "safari") {
            return {
              content: [
                {
                  type: "text",
                  text: "Safari 浏览器在 Windows 平台上不可用。"
                }
              ]
            };
          } else {
            command = `start "${url}"`;
          }
        } else if (platform === "linux") {  // Linux
          if (browser === "chrome") {
            command = `google-chrome "${url}"`;
          } else if (browser === "firefox") {
            command = `firefox "${url}"`;
          } else if (browser === "safari") {
            return {
              content: [
                {
                  type: "text",
                  text: "Safari 浏览器在 Linux 平台上不可用。"
                }
              ]
            };
          } else {
            command = `xdg-open "${url}"`;
          }
        } else {
          return {
            content: [
              {
                type: "text",
                text: `不支持的操作系统: ${platform}`
              }
            ]
          };
        }
        
        // 执行命令
        await execAsync(command);
        
        return {
          content: [
            {
              type: "text",
              text: `已成功在${browser === "default" ? "默认" : browser}浏览器中打开 ${url}`
            }
          ]
        };
      } catch (error) {
        console.error("打开浏览器失败:", error);
        return {
          content: [
            {
              type: "text",
              text: `打开浏览器失败: ${error.message || String(error)}`
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