import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import express, { Request, Response, Express, Application } from 'express';
import { NextFunction } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import * as fs from 'fs';
import MCPClient from '../mcpClient';
import { MCPTool } from '../types';
import { DEEPSEEK_DEFAULT_URL, OPENAI_DEFAULT_URL, OPENAI_MODELS, DEEPSEEK_MODELS } from '../constants';
import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import logger from '../logger';
import { AIProviderFactory, ProviderType } from '../providers/aiProviderFactory';

// 加载环境变量
dotenv.config();

// 设置应用名称
app.name = 'AI-CLIENT';

// 设置Express服务器
const expressApp: Application = express();
const PORT = process.env.PORT || 3001; // 修改为3001避免与Vue开发服务器冲突

// 默认提供商类型
let defaultProviderType: ProviderType = 'deepseek';

// MCP工具列表
let mcpTools: Array<MCPTool> = [];

// 初始化AI提供商
function initDefaultProviders() {
  // 初始化DeepSeek客户端
  AIProviderFactory.getProvider('deepseek', {
  apiKey: '',
    baseURL: DEEPSEEK_DEFAULT_URL,
    defaultModel: DEEPSEEK_MODELS.DEFAULT
});

  // 初始化OpenAI客户端
  AIProviderFactory.getProvider('openai', {
  apiKey: '',
    baseURL: OPENAI_DEFAULT_URL,
    defaultModel: OPENAI_MODELS.DEFAULT
  });
  
  logger.log('Main', '已初始化默认AI提供商');
}

// 初始化默认提供商
initDefaultProviders();

// MCP客户端
const mcpClient = new MCPClient("deepseek-client", "1.0.0");

// 初始化所有MCP工具
async function initMcpTools() {
  // 启动所有服务
  await mcpClient.startAllServers();
  // 收集所有工具
  mcpTools = await mcpClient.collectToolsFromAllServers();
}
initMcpTools();

/**
   * 调用mcp工具
   */
async function callMCPTool(
  toolCall: ChatCompletionMessageToolCall
) {
  // 无工具
  if (!toolCall.function || !toolCall.function.name) {
    throw new Error('MCP工具不存在');
  }

  logger.log('Main', 'MCP工具调用开始');
  logger.log('Main', `工具调用: ${JSON.stringify(toolCall)}`);

  try {
    // 解析参数 - 修复空字符串解析问题
    let args = {};
    if (toolCall.function.arguments && toolCall.function.arguments.trim() !== '') {
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (parseError) {
        logger.error('Main', `MCP工具解析参数失败: ${parseError}`);
        // 保持 args 为空对象并继续执行
      }
    }
    
    // 从工具名中提取服务器键和实际工具名
    const [serverKey, actualToolName] = toolCall.function.name.split('_SERVERKEYTONAME_');
    const result = await mcpClient.callTool(
      {
        name: actualToolName || toolCall.function.name,
        arguments: args
      },
      serverKey
    );

    logger.log('Main', `MCP工具调用成功: ${JSON.stringify(result)}`);
    
    return {
      status: true,
      id: toolCall.id,
      result: JSON.stringify(result)
    }
  } catch (err: any) {
    // 类型安全的错误处理
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error('Main', `MCP工具调用失败: ${errorMessage}`);

    return {
      status: false,
      id: toolCall.id,
      errorMessage: errorMessage
    }
  }
}

// 从配置文件加载配置
function initClientsFromConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      logger.log('Main', `读取到的配置: ${JSON.stringify(config, null, 2).substring(0, 100)}...`);
      
      if (config.providers) {
        // 默认提供商设置
        if (config.defaultProvider) {
          defaultProviderType = config.defaultProvider as ProviderType;
          logger.log('Main', `设置默认提供商: ${defaultProviderType}`);
        }
        
        // 更新DeepSeek客户端
        if (config.providers.deepseek?.apiKey) {
          AIProviderFactory.getProvider('deepseek', {
            apiKey: config.providers.deepseek.apiKey,
            baseURL: config.providers.deepseek.baseURL || DEEPSEEK_DEFAULT_URL,
            defaultModel: config.providers.deepseek.model || DEEPSEEK_MODELS.DEFAULT
          });
          logger.log('Main', '已从配置文件加载DeepSeek API配置');
        }
        
        // 更新OpenAI客户端
        if (config.providers.openai?.apiKey) {
          AIProviderFactory.getProvider('openai', {
            apiKey: config.providers.openai.apiKey,
            baseURL: config.providers.openai.baseURL || OPENAI_DEFAULT_URL,
            defaultModel: config.providers.openai.model || OPENAI_MODELS.DEFAULT
          });
          logger.log('Main', '已更新OpenAI API配置');
        }
      }
    }
  } catch (error) {
    logger.error('Main', `从配置文件初始化客户端失败: ${error}`);
  }
}

// 应用准备就绪后初始化
app.whenReady().then(() => {
  // 从配置文件加载配置
  initClientsFromConfig();
});

// 设置静态文件夹 - 提供API服务
expressApp.use(express.static(path.join(__dirname, '../../src/public')));

// 设置Vue构建输出的静态文件夹
expressApp.use(express.static(path.join(__dirname, '../../vue-client/dist')));

// 使用中间件解析请求主体
expressApp.use(bodyParser.json());
expressApp.use(bodyParser.urlencoded({ extended: true }));

// 路由器实例，用于定义API路由
const router = express.Router();

// 获取MCP工具列表
router.get('/api/tools', routeHandler(async (req: Request, res: Response) => {
  try {
    // 确保工具列表已初始化
    if (mcpTools.length === 0) {
      await initMcpTools();
    }
    res.json(mcpTools);
  } catch (error) {
    logger.error('Main', `获取MCP工具列表失败: ${error}`);
    res.status(500).json({ error: '获取MCP工具列表失败' });
  }
}));

// 主页路由 - 使用Vue应用代替EJS模板
router.get('/', routeHandler((req: Request, res: Response) => {
  // 检查Vue构建文件是否存在
  const vueDist = path.join(__dirname, '../../vue-client/dist/index.html');
  
  // 确保Vue dist目录存在
  const vueDistDir = path.join(__dirname, '../../vue-client/dist');
  if (!fs.existsSync(vueDistDir)) {
    try {
      fs.mkdirSync(vueDistDir, { recursive: true });
      logger.log('Main', `创建了Vue dist目录: ${vueDistDir}`);
    } catch (error) {
      logger.error('Main', `创建Vue dist目录失败: ${error}`);
    }
  }
  
  if (fs.existsSync(vueDist)) {
    // 提供Vue构建的HTML文件
    res.sendFile(vueDist);
  } else {
    // 如果Vue构建不存在，回退到EJS模板
    logger.warn('Main', 'Vue应用构建不存在，使用EJS模板替代');
    res.render('index');
  }
}));

// 处理所有路由 - 使用类型断言避免TypeScript编译错误
interface RouterHandler {
  (req: Request, res: Response): Promise<any> | any;
}

interface MiddlewareHandler {
  (req: Request, res: Response, next: NextFunction): void;
}

function routeHandler(handler: RouterHandler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // 直接调用处理函数获取结果
      const result = await handler(req, res);
      
      // 如果响应已结束，不执行后续代码
      if (res.headersSent) {
        return;
      }
      
      // 显式发送响应
      res.json(result);
    } catch (error) {
      logger.error('Main', `路由处理错误: ${error}`);
      
      // 如果响应已结束，不执行后续代码
      if (res.headersSent) {
        return;
      }
      
      // 发送错误响应
      res.status(500).json({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  };
}

function middlewareHandler(handler: MiddlewareHandler) {
  return handler as any; // 类型断言为any避免TypeScript错误
}

// 配置API路由 - 获取配置
router.get('/api/config', routeHandler((req: Request, res: Response) => {
  try {
    // 读取配置文件，如果存在的话
    const configPath = path.join(app.getPath('userData'), 'config.json');
    logger.log('Main', `读取配置文件: ${configPath}`);
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      logger.log('Main', '配置加载成功');
      res.json(config);
    } else {
      logger.log('Main', '配置文件不存在，返回空配置');
      res.json({});
    }
  } catch (error) {
    logger.error('Main', `读取配置失败: ${error}`);
    res.status(500).json({ error: '读取配置失败' });
  }
}));

// 配置API路由 - 保存配置
router.post('/api/config', routeHandler((req: Request, res: Response) => {
  try {
    // 保存配置到文件
    const configPath = path.join(app.getPath('userData'), 'config.json');
    logger.log('Main', `保存配置到文件: ${configPath}`);
    logger.log('Main', `配置内容: ${JSON.stringify(req.body)}`);
    
    // 确保目录存在
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    
    // 从配置文件加载配置
    initClientsFromConfig();

    logger.log('Main', '配置保存成功');
    res.json({ success: true });
  } catch (error) {
    logger.error('Main', `保存配置失败: ${error}`);
    res.status(500).json({ error: '保存配置失败' });
  }
}));

// 查询DeepSeek账户余额API
router.get('/api/deepseek/balance', routeHandler(async (req: Request, res: Response) => {
  const apiKey = req.query.apiKey as string;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'API密钥不能为空' });
  }
  
  try {
    // 使用fetch调用DeepSeek余额查询API
    const response = await fetch('https://api.deepseek.com/user/balance', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      logger.error('Main', `查询DeepSeek余额失败: ${response.status} ${JSON.stringify(errorData)}`);
      return res.status(response.status).json({ 
        error: '查询余额失败', 
        status: response.status,
        details: errorData
      });
    }
    
    // 返回余额信息
    const balanceData = await response.json();
    logger.log('Main', `DeepSeek余额信息: ${JSON.stringify(balanceData)}`);
    res.json(balanceData);
  } catch (error) {
    logger.error('Main', `查询DeepSeek余额错误: ${error}`);
    res.status(500).json({ 
      error: '查询余额失败', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}));

// 会话管理API

// 创建新会话
router.post('/api/sessions', routeHandler(async (req: Request, res: Response) => {
  logger.log('Main', `接收到创建会话请求: ${JSON.stringify(req.body || {})}`);
  try {
    logger.log('Main', '准备创建会话');
    
    // 确保req.body存在，提供默认值
    const reqBody = req.body || {};
    const providerType = reqBody.provider || defaultProviderType;
    
    logger.log('Main', `使用提供商: ${providerType}`);
    
    // 使用AIProviderFactory获取客户端
    const client = AIProviderFactory.getProvider(providerType as ProviderType);
    
    // 创建会话
    const sessionId = client.createSession();
    
    if (!sessionId) {
      logger.error('Main', '创建会话失败');
      // 直接发送响应而不是返回值
      res.status(500).json({ error: '创建会话失败: 未返回sessionId' });
      return;
    }
    
    logger.log('Main', `成功创建会话，ID: ${sessionId}，提供商: ${providerType}`);
    
    // 直接发送响应
    res.json(sessionId);
  } catch (err) {
    logger.error('Main', `创建会话失败: ${err}`);
    // 直接发送错误响应
    res.status(500).json({
      error: `创建会话失败: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}));

// 获取会话id列表
router.get('/api/sessionIds', routeHandler(async (req: Request, res: Response) => {
  logger.log('Main', '接收到获取会话id列表请求');
  try {
    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('获取会话id列表超时')), 5000);
    });
    
    const getSessionsPromise = (async () => {
      try {
        logger.log('Main', '准备获取会话id列表');
        const providerType = req.query.provider as ProviderType || defaultProviderType;
        
        // 使用AIProviderFactory获取客户端
        const client = AIProviderFactory.getProvider(providerType);
        
        // 获取会话列表
        const sessionIds = client.listSessionIds();
        
        logger.log('Main', `成功获取会话id列表: ${JSON.stringify(sessionIds)}`);
        return sessionIds;
      } catch (innerErr) {
        logger.error('Main', `获取会话id列表内部错误: ${innerErr}`);
        throw new Error(`获取会话id列表内部错误: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`);
      }
    })();
    
    // 使用Promise.race防止请求卡住
    return await Promise.race([getSessionsPromise, timeoutPromise]);
  } catch (err) {
    logger.error('Main', `获取会话id列表失败: ${err}`);
    // 返回空列表，允许前端继续
    return [];
  }
}));

// 获取会话历史
router.get('/api/sessions/:id', routeHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const providerType = req.query.provider as ProviderType || defaultProviderType;
    
    // 使用AIProviderFactory获取客户端
    const client = AIProviderFactory.getProvider(providerType);
    
    // 使用新的API获取会话历史
    try {
      const messages = client.getSessionMessages(sessionId);
      
      // 转换消息格式以适应前端需求
      const formattedMessages = messages.map(msg => ({
        ...msg,
        role: msg.role,
        content: msg.content,
        reasoningContent: msg.reasoning_content,
        // 添加其他前端需要的字段
      }));

      return formattedMessages;
    } catch (error) {
      if (error instanceof Error && error.message === '会话不存在') {
        throw new Error('会话不存在');
      }
      throw error;
    }
  } catch (err) {
    logger.error('Main', `获取会话历史失败: ${err}`);
    throw new Error(`获取会话历史失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}));

// 发送消息到会话
router.post('/api/sessions/:id/messages', routeHandler(async (req: Request, res: Response) => {
  try {
    // 已废弃，所有请求都应使用流式API
    return res.status(301).json({
      content: "请使用流式API: /api/sessions/:id/messages/stream",
      role: 'system',
      reasoningContent: "该端点已废弃，仅支持流式API"
    });
  } catch (err) {
    logger.error('Main', `发送消息失败: ${err}`);
    throw new Error(`发送消息失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}));

// 添加一个临时存储来保存消息请求，用于流式接口
const streamRequestsStore: Map<string, { message: string, selectedTools?: string[] | undefined, options?: any }> = new Map();

// 为SSE格式化并发送数据
function sendData(res: Response, data: any) {
  try {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // 使用兼容的方式尝试刷新流
    const response = res as any;
    if (typeof response.flush === 'function') {
      response.flush();
    }
  } catch (error) {
    // 忽略刷新错误
    logger.warn('Main', `刷新SSE流失败: ${error}`);
  }
}

// 为SSE发送完成信号并关闭连接
function endStream(res: Response, finalData?: any) {
  try {
    // 发送最终数据（如果有）
    if (finalData) {
      sendData(res, finalData);
    }
    
    // 发送完成信号
    sendData(res, { done: true });
    
    // 使用setTimeout避免立即关闭连接导致的问题
    setTimeout(() => {
      try {
        res.end();
      } catch (error) {
        logger.error('Main', `关闭SSE连接失败: ${error}`);
      }
    }, 200);
  } catch (error) {
    logger.error('Main', `结束SSE流失败: ${error}`);
    try {
      res.end();
    } catch (innerError) {
      // 最后的尝试，忽略错误
    }
  }
}

// 接收流式请求数据
router.post('/api/sessions/:id/messages/stream', (req: Request, res: Response) => {
  try {
    const { message, selectedTools, options } = req.body;
    const sessionId = req.params.id;
    
    // 存储请求数据，以便GET请求处理
    const requestId = `${sessionId}_${Date.now()}`;
    streamRequestsStore.set(requestId, { message, selectedTools, options });
    
    // 设置过期时间，60秒后自动清理
    setTimeout(() => {
      streamRequestsStore.delete(requestId);
      logger.log('Main', `已清理流式请求数据: ${requestId}`);
    }, 120000);
    
    // 返回请求ID
    res.json({ requestId });
  } catch (error) {
    logger.error('Main', `准备流式请求失败: ${error}`);
    res.status(500).json({ 
      error: `准备流式请求失败: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
});

// 处理流式GET请求，建立SSE连接
router.get('/api/sessions/:id/messages/stream', (req: Request, res: Response) => {
  const requestId = req.query.requestId as string;
  
  if (!requestId) {
    res.status(400).json({ error: 'Missing requestId parameter' });
    return;
  }
  
  const requestData = streamRequestsStore.get(requestId);
  
  if (!requestData) {
    res.status(404).json({ error: 'Request not found or expired' });
    return;
  }
  
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 防止Nginx缓冲
  
  // 设置超时时间为较长时间，避免连接过早关闭
  req.socket.setTimeout(120000);
  
  // 监听客户端断开连接
  req.on('close', () => {
    logger.log('Main', `客户端断开SSE连接: ${requestId}`);
    // 清理请求数据
    streamRequestsStore.delete(requestId);
  });
  
  res.flushHeaders();
  
  const sessionId = req.params.id;
  const { message, selectedTools, options } = requestData;

  console.log("!!!!!!!!!!!!!!!!!");
  console.log(selectedTools);
  console.log(mcpTools);
  console.log(selectedTools?.[0]);
  
  (async () => {
    try {
      // 根据配置选择客户端
      const providerName = options?.provider || defaultProviderType;
      
      // 使用AIProviderFactory获取客户端
      const client = AIProviderFactory.getProvider(providerName as ProviderType);
      
      if (!client) {
        sendData(res, { error: 'API client not initialized' });
        endStream(res);
        return;
      }
      
      try {
        // 开始流式请求
        const streamResult = await client.sendStreamMessageToSession({
          sessionId, 
          message,
          options,
          // 根据用户选择过滤工具列表
          mcpTools: selectedTools && selectedTools.length > 0
            ? mcpTools.filter(tool => selectedTools.find(toolName => tool.name.startsWith(`${toolName}_SERVERKEYTONAME`)))
            : undefined
        });

        // 完整的响应内容
        let fullContent = '';
        // 完整的推理内容
        let fullReasoningContent = '';
        // 需要调用的工具
        let toolCalls: Array<ChatCompletionMessageToolCall> | null = null;
        // 需要调用的工具的提示
        let toolTips: Array<string> | null = null;
        // 当前调用工具index
        let nowToolCallIndex = -1;
        
        // 持续的流
        const stream = streamResult.stream;

        for await (const chunk of stream) {
          // 处理普通文字
          if (chunk.choices && chunk.choices[0]?.delta?.content) {
            const content = chunk.choices[0].delta.content;
            fullContent += content;
            sendData(res, { content });
          }
          
          // 处理推理内容（如果有）
          if (chunk.choices && 
              chunk.choices[0]?.delta && 
              'reasoning_content' in chunk.choices[0].delta) {
            const reasoningContent = chunk.choices[0].delta.reasoning_content as string;
            if (reasoningContent) {
              fullReasoningContent += reasoningContent;
              sendData(res, { reasoningContent });
            }
          }

          // 处理工具调用（如果有）
          if (
            chunk.choices && 
            chunk.choices[0] &&
            chunk.choices[0].delta?.tool_calls &&
            chunk.choices[0].delta?.tool_calls[0]
          ) {
            // 从chunk中获取工具调用
            if (chunk.choices[0].delta?.tool_calls[0].type === 'function') {
              // 工具index+1
              nowToolCallIndex += 1;
              // 赋值
              if (!toolCalls) {
                toolCalls = [];
              }
              if (!toolCalls[nowToolCallIndex]) {
                toolCalls[nowToolCallIndex] = chunk.choices[0].delta?.tool_calls[0] as ChatCompletionMessageToolCall;
              }
              if (!toolTips) {
                toolTips = [];
              }
              if (!toolTips[nowToolCallIndex]) {
                toolTips[nowToolCallIndex] = '#useTool';
                toolTips[nowToolCallIndex] += `<toolName>${toolCalls[nowToolCallIndex].function.name}</toolName>`;
                toolTips[nowToolCallIndex] += `<toolArgs>${toolCalls[nowToolCallIndex].function.arguments}`;
              }
            }

            // 从chunk中获取第一个工具调用的参数
            if (chunk.choices[0].delta.tool_calls[0].function) {
              const addStr = chunk.choices[0].delta.tool_calls[0].function.arguments;
              
              if (toolCalls && toolCalls[nowToolCallIndex]) {
                toolCalls[nowToolCallIndex].function.arguments += addStr;
              }
              if(toolTips && toolTips[nowToolCallIndex]) {
                toolTips[nowToolCallIndex] += addStr;
              }
            }
          }
        }

        // 当前session
        const session = client.getSession(sessionId);
        // 信息是否更新
        let isMessageUpdate = false;

        // 文字流
        if (fullContent || fullReasoningContent) {
          // 将完整响应添加到会话历史
          session?.addAssistantMessage(fullContent, fullReasoningContent);
          // 信息更新
          isMessageUpdate = true;
        }

        // 有需要调用的工具
        if (toolCalls && toolCalls.length > 0) {
          // 添加末尾的</toolArgs>
          if (toolTips) {
            toolTips = toolTips?.map(tip => tip += '</toolArgs>');
          }
          
          // 添加工具调用会话历史
          session?.addAssistantMessage(toolTips ? toolTips.join('\n') : '', '', toolCalls);
          // 信息更新
          isMessageUpdate = true;
        }

        if (isMessageUpdate) {
          // 提醒前端更新信息
          sendData(res, { isMessageUpdate: true });
        }

        // 遍历开始调用工具
        if (toolCalls) {
          for(const toolCall of toolCalls) {
            // 调用工具获取结果
            const toolRes = await callMCPTool(toolCall);

            if (toolRes.status) {
              // 调用成功
              // 添加工具成功到会话
              session?.addToolMessage(
                toolRes.id || '',
                toolRes.result || '',
              );
            } else {
              // 调用失败
              // 添加工具失败到会话
              session?.addToolMessage(
                toolRes.id || '',
                JSON.stringify({errorMessage: toolRes.errorMessage}),
              );
        }

            // 提醒前端更新信息
            sendData(res, { isMessageUpdate: true, toolCall });
          }
        }

        // 完成响应
        endStream(res, { complete: true });
      } catch (error) {
        logger.error('Main', `流式请求失败: ${error}`);
        sendData(res, { 
          error: `流式请求失败: ${error instanceof Error ? error.message : String(error)}` 
        });
        endStream(res);
      }
    } catch (error) {
      logger.error('Main', `处理流式请求失败: ${error}`);
      sendData(res, { 
        error: `处理流式请求失败: ${error instanceof Error ? error.message : String(error)}` 
      });
      endStream(res);
    }
  })();
});

// 删除会话
router.delete('/api/sessions/:id', routeHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const providerType = req.query.provider as ProviderType || defaultProviderType;
    
    // 使用AIProviderFactory获取客户端
    const client = AIProviderFactory.getProvider(providerType);
    
    // 使用新的API结束会话
    const success = client.endSession(sessionId);
    if (!success) {
      throw new Error('会话不存在');
    }
    return { success: true };
  } catch (err) {
    logger.error('Main', `删除会话失败: ${err}`);
    throw new Error(`删除会话失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}));

// 使用路由器
expressApp.use(router);

// 处理所有其他GET请求 - 支持Vue的路由模式
expressApp.use(middlewareHandler((req: Request, res: Response, next: NextFunction) => {
  // 跳过API请求和静态资源
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return next();
  }

  const vueDist = path.join(__dirname, '../../vue-client/dist/index.html');
  if (fs.existsSync(vueDist)) {
    res.sendFile(vueDist);
  } else {
    // 如果Vue构建不存在，回退到EJS模板或404
    logger.warn(`Main`, `Vue应用构建不存在，无法处理路由: ${req.path}`);
    res.status(404).send('Vue应用未构建，请先运行 npm run vue:build');
  }
}));

// 启动Express服务器
let server = expressApp.listen(PORT, () => {
  logger.log('Main', `Express服务器运行在 http://localhost:${PORT}`);
});

// 保存对主窗口的引用，避免被JavaScript的GC机制回收
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // 获取preload脚本路径
  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  
  if (!preloadExists) {
    logger.warn('Main', `警告: Preload脚本不存在: ${preloadPath}`);
  }
  
  // 创建图标
  const iconPath = path.join(__dirname, '../../src/assets/logo.png');
  const icon = nativeImage.createFromPath(iconPath);
  
  // 设置Dock图标（仅macOS）
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(icon);
  }
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // 只有在preload文件存在时才设置
      ...(preloadExists ? { preload: preloadPath } : {})
    },
    icon: icon,
    // macOS特定配置 - 使用自定义标题栏
    titleBarStyle: process.platform === 'darwin' ? 'customButtonsOnHover' : 'default',
    frame: true,
    backgroundColor: '#ffffff'
  });

  // 根据环境决定加载方式
  const isDev = process.env.NODE_ENV === 'development';
  
  // 开发环境 - 尝试连接到Vue的开发服务器
  if (isDev && process.env.VUE_DEV_SERVER_URL) {
    logger.log('Main', `加载开发服务器: ${process.env.VUE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VUE_DEV_SERVER_URL);
  } else {
    // 尝试加载Express服务器上的页面
    const serverUrl = `http://localhost:${PORT}`;
    logger.log('Main', `加载Express服务: ${serverUrl}`);
    mainWindow.loadURL(serverUrl);
  }
  
  // 设置窗口标题
  mainWindow.setTitle('DeepSeek客户端');
  
  // 页面加载完成后更新标题
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.setTitle('DeepSeek客户端');
    }
  });

  // 当窗口关闭时触发的事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 在开发环境中打开DevTools
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// 处理IPC通信
ipcMain.handle('app:version', () => {
  return app.getVersion();
});

ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({});
  if (!canceled) {
    return filePaths[0];
  }
  return null;
});

// 当Electron初始化完成后调用此方法创建主窗口
app.on('ready', () => {
  // 为macOS创建应用图标
  if (process.platform === 'darwin') {
    const iconPath = path.join(__dirname, '../../src/assets/logo.png');
    try {
      const icon = nativeImage.createFromPath(iconPath);
      app.dock?.setIcon(icon);
    } catch (error) {
      logger.error('Main', `设置Dock图标失败: ${error}`);
    }
  }
  
  createWindow();
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，用户通常希望应用在所有窗口关闭后继续运行直到明确退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
  
  // 关闭Express服务器
  if (server) {
    server.close();
  }
});

app.on('activate', () => {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时，通常会重新创建应用窗口
  if (mainWindow === null) {
    createWindow();
  }
});

// 退出前清理
app.on('will-quit', () => {
  if (server) {
    server.close();
  }
});