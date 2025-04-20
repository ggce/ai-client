import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

/**
 * 天气服务器 - 实现MCP协议
 */
async function main() {
  // 创建MCP服务器
  const server = new McpServer({
    name: "weather-server",
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

  // 注册资源 - 使用ResourceTemplate以支持动态URI模板
  server.resource(
    "cities-list",
    "weather://cities",
    {
      name: "支持的城市列表",
      description: "WeatherServer支持的城市列表",
      mimeType: "application/json"
    },
    async (uri) => {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(["北京", "上海", "广州", "深圳", "杭州", "南京", "成都", "重庆", "武汉"]),
          mimeType: "application/json"
        }]
      };
    }
  );

  // 注册提示
  server.prompt(
    "weather-query",             // 提示名称
    "天气查询提示",               // 提示描述
    {
      location: z.string().describe("查询位置")
    },
    (args, extra) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `请提供${args.location}的天气信息。`
            }
          }
        ]
      };
    }
  );

  // 注册天气工具
  server.tool(
    "getWeather",                // 工具名称
    "获取城市天气信息",           // 工具描述
    {
      location: z.string().describe("城市名称")
    },
    async ({ location }) => {
      console.log(`收到天气查询请求，位置: ${location}`);
      
      // 模拟天气数据
      const temperature = Math.floor(15 + Math.random() * 15);
      const condition = ["晴", "多云", "阴", "小雨", "大雨"][Math.floor(Math.random() * 5)];
      const humidity = Math.floor(40 + Math.random() * 40);
      const windSpeed = Math.floor(10 + Math.random() * 20) / 10;
      const windDirection = ["东", "南", "西", "北", "东北", "东南", "西北", "西南"][Math.floor(Math.random() * 8)];
      
      return {
        content: [
          {
            type: "text",
            text: `${location}天气情况：
温度：${temperature}°C
天气状况：${condition}
湿度：${humidity}%
风速：${windSpeed}m/s
风向：${windDirection}风
预报：未来几天气温稳定`
          }
        ]
      };
    }
  );

  // 使用stdio传输方式
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log("天气服务器已启动");
}

// 启动服务器
main().catch(err => {
  console.error("天气服务器启动失败:", err);
  process.exit(1);
});