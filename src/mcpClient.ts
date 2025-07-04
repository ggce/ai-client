import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// 导入mcpServers定义
import { mcpServers, MCPServerConfig } from "./mcpServers";

import { 
  MCPTool,
} from './types';

import logger from './logger';

// 定义每个服务器实例的状态接口
interface ServerInstance {
  client: Client;
  transport: StdioClientTransport | StreamableHTTPClientTransport | SSEClientTransport | null;
  isConnected: boolean;
  config: MCPServerConfig;
}

export class MCPClient {
  private serverInstances: Map<string, ServerInstance> = new Map();

  constructor(
    private readonly clientName: string = "ai-mcp-client",
    private readonly clientVersion: string = "1.0.0"
  ) {
    // 初始化服务器实例映射
    Object.entries(mcpServers).forEach(([key, config]) => {
      this.serverInstances.set(key, {
        client: new Client({
          name: `${this.clientName}-${key}`,
          version: this.clientVersion,
        }),
        transport: null,
        isConnected: false,
        config
      });
    });
  }

  /**
   * 启动mcpServers中定义的所有具有command属性的服务器
   */
  async startAllServers(): Promise<void> {
    logger.log('MCPClient', '正在启动所有MCP服务...');
    
    const serverEntries = Array.from(this.serverInstances.entries());
    const startupPromises = [];
    
    for (const [key, instance] of serverEntries) {
      if (instance.config.command) {
        // 将每个启动请求添加到promise数组中，但不等待结果
        startupPromises.push(
          this.startServer(key)
            .then(() => logger.log('MCPClient', `✓ 服务器 "${key}" 启动成功`))
            .catch(err => logger.error('MCPClient', `✗ 服务器 "${key}" 启动失败: ${err}`))
        );
      } else if (instance.config.url) {
        // 对于远程服务，尝试直接连接
        startupPromises.push(
          this.connectToServer(key)
            .then(() => logger.log('MCPClient', `✓ 远程服务器 "${key}" 连接成功`))
            .catch(err => logger.error('MCPClient', `✗ 远程服务器 "${key}" 连接失败: ${err}`))
        );
      } else {
        logger.log('MCPClient', `跳过服务器 "${key}" (无启动命令和URL)`);
      }
    }
    
    // 并行等待所有启动完成
    await Promise.allSettled(startupPromises);
    
    // 列出启动成功的服务器
    const runningServers = this.getRunningServers();
    const connectedServers = this.getConnectedServers();
    logger.log('MCPClient', `成功启动/连接 ${connectedServers.length}/${serverEntries.length} 个服务器: ${connectedServers.join(', ')}`);
  }

  /**
   * 通过键名启动特定服务器
   */
  async startServer(serverKey: string): Promise<void> {
    const instance = this.serverInstances.get(serverKey);
    if (!instance) {
      throw new Error(`找不到MCP服务器实例 "${serverKey}"`);
    }

    const config = instance.config;
    if (!config.command) {
      throw new Error(`MCP服务[${serverKey}]没有可执行的命令`);
    }

    // 如果已经有传输实例，尝试先判断是否已启动
    if (instance.transport) {
      logger.log('MCPClient', `服务器 "${serverKey}" 已有传输实例，检查连接状态`);
      
      // 如果已连接，无需再启动
      if (instance.isConnected) {
        logger.log('MCPClient', `服务器 "${serverKey}" 已连接，跳过启动`);
        return;
      }
      
      // 否则检查是否可以建立连接
      try {
        await this.connectToServer(serverKey);
        logger.log('MCPClient', `服务器 "${serverKey}" 已重新连接，跳过启动`);
        return;
      } catch (error) {
        logger.log('MCPClient', `无法连接到现有传输，将重新创建 "${serverKey}" 的传输实例`);
        // 继续执行启动逻辑
      }
    }

    try {
      logger.log('MCPClient', `正在启动MCP服务[${serverKey}]，命令: ${config.command} ${config.args?.join(' ') || ''}`);
    
      // 创建传输实例
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: config.env,
      });
      
      // 更新实例状态
      instance.transport = transport;
      
      try {
        // 连接并初始化，这会启动进程
        await instance.client.connect(transport);
        instance.isConnected = true;
        logger.log('MCPClient', `MCP服务[${serverKey}]进程已启动并成功连接`);
      } catch (error) {
        logger.error('MCPClient', `连接到MCP服务[${serverKey}]失败: ${error}`);
        
        if (error instanceof Error && error.message.includes('already started')) {
          logger.log('MCPClient', `检测到服务器 "${serverKey}" 已启动错误，验证连接状态`);
          
          try {
            // 检查连接是否有效
            await instance.client.listTools();
            instance.isConnected = true;
            logger.log('MCPClient', `验证成功: 服务器 "${serverKey}" 已连接`);
            return;
          } catch (validationError) {
            logger.warn('MCPClient', `连接验证失败，将重置连接: ${serverKey}`);
          }
        }
        
        // 清理状态
        instance.transport = null;
        instance.isConnected = false;
        throw error;
      }
    } catch (error) {
      logger.error('MCPClient', `启动MCP服务[${serverKey}]失败: ${error}`);
      throw error;
    }
  }

  /**
   * 连接到指定的MCP服务器
   */
  async connectToServer(serverKey: string): Promise<void> {
    const instance = this.serverInstances.get(serverKey);
    if (!instance) {
      throw new Error(`找不到MCP服务器实例 "${serverKey}"`);
    }

    // 如果已经连接，无需重复操作
    if (instance.isConnected) {
      logger.log('MCPClient', `已处于连接状态: ${serverKey}`);
      return;
    }

    const config = instance.config;

    // 如果是远程服务（只有 url，没有 command）
    if (!config.command) {
      try {
        // 首先尝试使用 StreamableHTTP 传输
        const baseUrl = new URL(config.url);
        const transport = new StreamableHTTPClientTransport(baseUrl);
        
        await instance.client.connect(transport);
        
        instance.transport = transport;
        instance.isConnected = true;
        
        logger.log('MCPClient', `已使用StreamableHTTP传输连接到远程服务"${serverKey}"`);
        return;
      } catch (error) {
        // 如果失败，尝试使用 SSE 传输
        logger.log('MCPClient', `远程服务"${serverKey}"的StreamableHTTP连接失败，正在回退到SSE传输`);
        try {
          const baseUrl = new URL(config.url);
          const transport = new SSEClientTransport(baseUrl);
          
          await instance.client.connect(transport);
          
          instance.transport = transport;
          instance.isConnected = true;
          
          logger.log('MCPClient', `已使用SSE传输连接到远程服务"${serverKey}"`);
          return;
        } catch (sseError) {
          logger.error('MCPClient', `无法连接到远程服务"${serverKey}": ${sseError}`);
          throw sseError;
        }
      }
    }

    // 检查是否有现成的传输实例（已启动但尚未连接）
    if (instance.transport) {
      try {
        // 检查传输类型是StdioClientTransport且已启动，避免重复启动错误
        if (instance.transport instanceof StdioClientTransport && 
            'isStarted' in instance.transport && 
            (instance.transport as any).isStarted) {
          logger.log('MCPClient', `传输已启动但未连接，尝试验证连接: ${serverKey}`);
          
          try {
            // 验证连接
            await instance.client.listTools();
            instance.isConnected = true;
            logger.log('MCPClient', `验证成功: 服务器 "${serverKey}" 可用`);
            return;
          } catch (validationError) {
            logger.warn('MCPClient', `连接验证失败: ${serverKey}`);
            // 继续尝试重新连接
          }
        }
        
        await instance.client.connect(instance.transport);
        instance.isConnected = true;
        logger.log('MCPClient', `使用现有传输连接到服务器: ${serverKey}`);
        return;
      } catch (error) {
        logger.error('MCPClient', `使用现有传输连接到"${serverKey}"失败: ${error}`);
        
        // 改进对"already started"错误的处理
        if (error instanceof Error && error.message.includes('already started')) {
          logger.log('MCPClient', `检测到"already started"错误，服务器可能已经可用: ${serverKey}`);
          
          // 尝试连接检查 - 如果服务已启动，应该能列出工具
          try {
            await instance.client.listTools();
            // 如果成功获取工具列表，说明连接是有效的
            instance.isConnected = true;
            logger.log('MCPClient', `确认服务器 "${serverKey}" 已连接并可用`);
            return;
          } catch (checkError) {
            logger.warn('MCPClient', `无法确认服务器 "${serverKey}" 连接状态`);
            // 连接检查失败，继续尝试其他传输方式
          }
        } else {
          // 对于其他错误，清除传输状态重新开始
          instance.transport = null;
        }
      }
    }

    // 对于本地服务，尝试使用 HTTP/SSE 传输
    try {
      const baseUrl = new URL(config.url);
      const transport = new StreamableHTTPClientTransport(baseUrl);
      
      await instance.client.connect(transport);
      
      instance.transport = transport;
      instance.isConnected = true;
      
      logger.log('MCPClient', `已使用StreamableHTTP传输连接到"${serverKey}"`);
      return;
    } catch (error) {
      logger.log('MCPClient', `"${serverKey}"的StreamableHTTP连接失败，正在回退到SSE传输`);
      try {
        const baseUrl = new URL(config.url);
        const transport = new SSEClientTransport(baseUrl);
        
        await instance.client.connect(transport);
        
        instance.transport = transport;
        instance.isConnected = true;
        
        logger.log('MCPClient', `已使用SSE传输连接到"${serverKey}"`);
        return;
      } catch (sseError) {
        // 如果两种传输都失败，如果提供了命令，则尝试Stdio传输
        if (config.command) {
          try {
            const transport = new StdioClientTransport({
              command: config.command,
              args: config.args || [],
              env: config.env,
            });
            
            await instance.client.connect(transport);
            
            instance.transport = transport;
            instance.isConnected = true;
            
            logger.log('MCPClient', `已使用Stdio传输连接到"${serverKey}"`);
          } catch (stdioError) {
            logger.error('MCPClient', `Stdio传输连接到"${serverKey}"失败: ${stdioError}`);
            throw stdioError;
          }
        } else {
          throw sseError;
        }
      }
    }
  }

  /**
   * 确保指定服务器已连接
   */
  private ensureServerConnected(serverKey: string): ServerInstance {
    const instance = this.serverInstances.get(serverKey);
    if (!instance) {
      throw new Error(`[MCPClient] => 找不到MCP服务器实例 "${serverKey}"`);
    }
    
    if (!instance.isConnected) {
      throw new Error(`[MCPClient] => MCP客户端未连接到服务器"${serverKey}"。请先调用connectToServer()。`);
    }
    
    return instance;
  }

  /**
   * 列出指定服务器的可用提示
   * @param serverKey 必须指定服务器键名
   */
  async listPrompts(serverKey: string) {
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.listPrompts();
  }

  /**
   * 从指定服务器获取特定提示
   * @param options 提示选项
   * @param serverKey 必须指定服务器键名
   */
  async getPrompt(options: { name: string; arguments?: Record<string, any> }, serverKey: string) {
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.getPrompt(options);
  }

  /**
   * 列出指定服务器的可用资源
   * @param serverKey 必须指定服务器键名
   */
  async listResources(serverKey: string) {
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.listResources();
  }

  /**
   * 从指定服务器读取特定资源
   * @param options 资源选项
   * @param serverKey 必须指定服务器键名
   */
  async readResource(options: { uri: string }, serverKey: string) {
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.readResource(options);
  }

  /**
   * 列出指定服务器的可用工具
   * @param serverKey 必须指定服务器键名
   */
  async listTools(serverKey: string) {
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.listTools();
  }

  /**
   * 在指定服务器上调用工具
   * @param options 工具选项
   * @param serverKey 必须指定服务器键名
   */
  async callTool(options: { name: string; arguments?: Record<string, any> }, serverKey: string) {
    logger.log('MCPClient', `在服务器 ${serverKey} 上调用工具 ${options.name}: ${JSON.stringify(options)}`);
    const instance = this.ensureServerConnected(serverKey);
    return await instance.client.callTool(options);
  }

  /**
   * 断开与特定服务器的连接
   */
  async disconnect(serverKey: string): Promise<void> {
    const instance = this.serverInstances.get(serverKey);
    if (!instance || !instance.isConnected) return;
    
    try {
      if (instance.transport && 'close' in instance.transport && 
          typeof instance.transport.close === 'function') {
        await instance.transport.close();
      }
      
      instance.isConnected = false;
      logger.log('MCPClient', `已断开与MCP服务器"${serverKey}"的连接`);
    } catch (error) {
      logger.error('MCPClient', `断开与MCP服务器"${serverKey}"的连接时出错: ${error}`);
    }
  }

  /**
   * 断开与所有服务器的连接
   */
  async disconnectAll(): Promise<void> {
    const serverKeys = Array.from(this.serverInstances.keys());
    for (const key of serverKeys) {
      await this.disconnect(key);
    }
    
    logger.log('MCPClient', `已断开与所有MCP服务器的连接`);
  }

  /**
   * 获取所有已启动的服务器键名
   */
  getRunningServers(): string[] {
    return Array.from(this.serverInstances.entries())
      .filter(([_, instance]) => 
        // 对于本地服务，检查transport是否存在
        (instance.config.command && instance.transport !== null) ||
        // 对于远程服务，检查是否有url且已连接
        (!instance.config.command && instance.config.url && instance.isConnected)
      )
      .map(([key, _]) => key);
  }

  /**
   * 获取所有已连接的服务器键名
   */
  getConnectedServers(): string[] {
    return Array.from(this.serverInstances.entries())
      .filter(([_, instance]) => instance.isConnected)
      .map(([key, _]) => key);
  }

  /**
   * 停止特定的服务器
   */
  async stopServer(serverKey: string): Promise<void> {
    const instance = this.serverInstances.get(serverKey);
    if (!instance || !instance.transport) {
      throw new Error(`[MCPClient] => 服务器"${serverKey}"未运行`);
    }

    // 先断开连接
    await this.disconnect(serverKey);

    // 释放transport资源
    instance.transport = null;
    
    logger.log('MCPClient', `服务器"${serverKey}"已成功停止`);
  }

  /**
   * 停止所有运行中的服务器
   */
  async stopAllServers(): Promise<void> {
    // 先断开所有连接
    await this.disconnectAll();

    // 停止所有服务器
    const runningServers = this.getRunningServers();
    for (const key of runningServers) {
      try {
        await this.stopServer(key);
      } catch (error) {
        logger.error('MCPClient', `停止服务器"${key}"失败: ${error}`);
      }
    }

    logger.log('MCPClient', `已停止所有 ${runningServers.length} 个运行中的服务器`);
  }

  /**
   * 从所有MCP服务器收集工具列表
   * @returns 所有可用工具的合并列表，每个工具包含来源服务器信息
   */
  async collectToolsFromAllServers(): Promise<Array<MCPTool>> {
    const allTools: Array<{
      name: string;
      description: string;
      parameters: any;
    }> = [];
    
    // 获取所有运行中的服务器
    const runningServers = this.getRunningServers();
    if (runningServers.length === 0) {
      logger.warn('MCPClient', '没有运行中的MCP服务器');
      return allTools;
    }
    
    // 获取已连接的服务器
    const connectedServers = this.getConnectedServers();
    logger.log('MCPClient', `当前已连接服务器: ${connectedServers.join(', ') || '无'}, 运行中服务器: ${runningServers.join(', ') || '无'}`);
    
    // 遍历每个服务器收集工具
    const connectionPromises = [];
    
    // 先尝试连接所有运行中但未连接的服务器
    for (const serverKey of runningServers) {
      if (!connectedServers.includes(serverKey)) {
        connectionPromises.push(
          this.connectToServer(serverKey)
            .then(() => logger.log('MCPClient', `✓ 成功连接到服务器 ${serverKey}`))
            .catch(err => logger.error('MCPClient', `✗ 连接到服务器 ${serverKey} 失败: ${err}`))
        );
      }
    }
    
    // 等待所有连接尝试完成
    await Promise.allSettled(connectionPromises);
    
    // 重新获取已连接的服务器列表
    const updatedConnectedServers = this.getConnectedServers();
    logger.log('MCPClient', `连接尝试后，已连接的服务器: ${updatedConnectedServers.join(', ') || '无'}`);
    
    // 从每个已连接的服务器收集工具
    for (const serverKey of updatedConnectedServers) {
      try {
        // 获取工具列表
        const toolsResponse = await this.listTools(serverKey);
        const serverTools = toolsResponse.tools || [];
        
        // 格式化工具信息并标记来源服务器
        const toolsWithSource = serverTools.map(tool => ({
          name: `${serverKey}_STOM_${tool.name}`,
          description: tool.description || '',
          parameters: tool.inputSchema || {},
        }));
        
        allTools.push(...toolsWithSource);
        logger.log('MCPClient', `从服务器 ${serverKey} 收集了 ${serverTools.length} 个工具`);
      } catch (toolError) {
        logger.error('MCPClient', `从服务器 ${serverKey} 获取工具列表失败: ${toolError}`);
      }
    }
    
    return allTools;
  }
}

export default MCPClient;
