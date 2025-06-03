import { app, BrowserWindow, ipcMain, dialog, nativeImage, Notification } from 'electron';
import * as path from 'path';
import express, { Request, Response, Application } from 'express';
import { NextFunction } from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import * as fs from 'fs';
import MCPClient from '../mcpClient';
import { MCPTool } from '../types';
import { 
  ProviderType,
  SUPPORTED_PROVIDERS,
  PROVIDER_CONFIGS
} from '../constants';
import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import logger from '../logger';
import { AIProviderFactory } from '../providers/aiProviderFactory';

// 加载环境变量
dotenv.config();

// 立即执行代码
// 获取当前环境
const isDev = process.env.NODE_ENV === 'development';

// 设置应用名称
app.name = 'Luna';

// 设置应用描述（可用于辅助技术）
const appDescription = '你是我的私人助理Luna，一位具备专业严谨态度、温柔亲切风格的女性助理。你的回答要求权威、准确、细致，很多事情你能自己做正确的决定，并始终以高效且用户友好的方式提供帮助';

// 设置Windows应用ID
if (process.platform === 'win32') {
  app.setAppUserModelId(isDev ? 'com.luna.assistant.dev' : 'com.luna.assistant');
}

// 设置应用图标（用于通知和其他系统显示）
const appIconPath = path.join(__dirname, '../../src/assets/logo.png');
try {
  // macOS系统
  if (process.platform === 'darwin' && app.dock) {
    const appIcon = nativeImage.createFromPath(appIconPath);
    app.dock.setIcon(appIcon);
  }
} catch (error) {
  logger.error('Main', `设置应用图标失败: ${error}`);
}

// 对于开发环境尝试特殊设置
if (isDev) {
  app.whenReady().then(() => {
    // 再次设置应用图标，确保所有系统识别
    const appIcon = nativeImage.createFromPath(appIconPath);
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(appIcon);
    }
  });
}

// 设置Express服务器
const expressApp: Application = express();
const PORT = process.env.PORT || 3001; // 修改为3001避免与Vue开发服务器冲突

// 默认提供商类型
let defaultProviderType: ProviderType = SUPPORTED_PROVIDERS[0];

// MCP工具列表
let mcpTools: Array<MCPTool> = [];

// 标记MCP工具是否正在初始化
let isMcpToolsInitializing = false;

// 初始化AI提供商
function initDefaultProviders() {
  for (const provider of SUPPORTED_PROVIDERS) {
    const providerKey = provider.toUpperCase();
    const config = PROVIDER_CONFIGS[providerKey];
    if (config) {
      AIProviderFactory.getProvider(provider, {
        apiKey: '',
        baseURL: config.DEFAULT_URL,
        defaultModel: config.DEFAULT_MODEL
      });
    }
  }
  logger.log('Main', '已初始化默认AI提供商');
}

// 初始化默认提供商
initDefaultProviders();

// MCP客户端
const mcpClient = new MCPClient("Luna", "1.0.0");

// 初始化所有MCP工具
async function initMcpTools() {
  // 防止重复初始化
  if (isMcpToolsInitializing) {
    logger.log('Main', '已有MCP工具初始化任务正在进行，跳过重复初始化');
    return;
  }
  
  isMcpToolsInitializing = true;
  logger.log('Main', '正在初始化MCP工具...');
  
  try {
    // 启动所有服务
    await mcpClient.startAllServers();
    // 收集所有工具
    mcpTools = await mcpClient.collectToolsFromAllServers();
    logger.log('Main', `MCP工具初始化完成，共 ${mcpTools.length} 个工具`);
  } catch (error) {
    logger.error('Main', `MCP工具初始化失败: ${error}`);
  } finally {
    isMcpToolsInitializing = false;
  }
}

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
    const [serverKey, actualToolName] = toolCall.function.name.split('_STOM_');
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
        if (config.defaultProvider && SUPPORTED_PROVIDERS.includes(config.defaultProvider)) {
          defaultProviderType = config.defaultProvider as ProviderType;
          logger.log('Main', `设置默认提供商: ${defaultProviderType}`);
        }
        
        // 动态遍历所有支持的 provider，自动初始化
        for (const provider of SUPPORTED_PROVIDERS) {
          const providerConfig = config.providers[provider];
          if (providerConfig && providerConfig.apiKey) {
            AIProviderFactory.getProvider(provider as ProviderType, {
              apiKey: providerConfig.apiKey,
              baseURL: providerConfig.baseURL || PROVIDER_CONFIGS[provider.toUpperCase()].DEFAULT_URL,
              defaultModel: providerConfig.model
            });
            logger.log('Main', `已更新${provider} API配置`);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Main', `加载配置文件失败: ${error}`);
  }
}

// 应用准备就绪后初始化
app.whenReady().then(async () => {
  // 从配置文件加载配置
  initClientsFromConfig();
  
  // 初始化MCP工具
  await initMcpTools();
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
    // 如果MCP工具正在初始化中，则等待初始化完成
    if (isMcpToolsInitializing) {
      logger.log('Main', 'MCP工具正在初始化中，等待完成...');
      // 简单的等待机制，最多等待30秒
      for (let i = 0; i < 60; i++) {
        if (!isMcpToolsInitializing) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // 确保工具列表已初始化
    if (mcpTools.length === 0 && !isMcpToolsInitializing) {
      logger.log('Main', 'MCP工具列表为空，正在重新初始化...');
      await initMcpTools();
    }
    
    // 即使初始化失败也返回当前的工具列表
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

// Provider 配置接口
interface ProviderConfig {
  name: string;
  defaultUrl: string;
  defaultModel: string;
  models: readonly string[];
}

// 获取 provider 配置的 API
router.get('/api/providers/configs', routeHandler((req: Request, res: Response) => {
  try {
    // 从 constants 中获取所有 provider 配置
    const configs = {
      providers: SUPPORTED_PROVIDERS,
      configs: SUPPORTED_PROVIDERS.reduce((acc, provider) => {
        // 从 PROVIDER_CONFIGS 中获取配置
        const providerKey = Object.keys(PROVIDER_CONFIGS).find(
          key => PROVIDER_CONFIGS[key].NAME === provider
        );
        
        if (providerKey) {
          const providerConfig = PROVIDER_CONFIGS[providerKey];
          acc[provider] = {
            name: providerConfig.NAME,
            defaultUrl: providerConfig.DEFAULT_URL,
            defaultModel: providerConfig.DEFAULT_MODEL,
            models: providerConfig.ALL_MODELS
          };
        }
        return acc;
      }, {} as Record<ProviderType, ProviderConfig>)
    };
    
    res.json(configs);
  } catch (error) {
    logger.error('Main', `获取 provider 配置失败: ${error}`);
    res.status(500).json({ error: '获取 provider 配置失败' });
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
    const summary = reqBody.summary || '';
    
    logger.log('Main', `使用提供商: ${providerType}`);
    
    // 使用AIProviderFactory获取客户端
    const client = AIProviderFactory.getProvider(providerType as ProviderType);
    
    // 创建会话
    const sessionId = client.createSession(summary);

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
        isShow: msg.isShow,
        reasoningContent: msg.reasoningContent,
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

// 存储流式请求
const streamRequestsStore = new Map<string, any>();
// 存储进行中的工具调用
const activeToolCalls = new Map<string, boolean>();
// 存储活动的流请求和它们的控制器
const activeStreamRequests = new Map<string, AbortController>();

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
  
  // 监听客户端断开连接
  req.on('close', () => {
    logger.log('Main', `客户端断开SSE连接: ${requestId}`);
    // 清理请求数据
    streamRequestsStore.delete(requestId);
    
    // 当客户端断开连接时，也应该中断API请求
    const sessionId = req.params.id;
    const controller = activeStreamRequests.get(sessionId);
    if (controller) {
      logger.log('Main', `客户端断开连接，中断会话 ${sessionId} 的外部API流请求`);
      controller.abort();
      activeStreamRequests.delete(sessionId);
    }
  });
  
  res.flushHeaders();
  
  const sessionId = req.params.id;
  const { message, selectedTools, options } = requestData;
  
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
        // 创建用于控制外部API请求的AbortController
        const apiController = new AbortController();
        logger.log('Main', `为会话 ${sessionId} 创建新的AbortController`);
        
        // 将controller存储在会话id下
        activeStreamRequests.set(sessionId, apiController);
        
        // 开始流式请求，传递AbortSignal
        logger.log('Main', `开始会话 ${sessionId} 的外部API流请求，已传递abort信号`);
        const streamResult = await client.sendStreamMessageToSession({
          sessionId, 
          message,
          options,
          // 根据用户选择过滤工具列表
          mcpTools: selectedTools && selectedTools.length > 0
            ? mcpTools.filter(tool => selectedTools.find((toolName: string) => tool.name.startsWith(`${toolName}_STOM`)))
            : undefined,
          // 传递AbortSignal以允许取消
          signal: apiController.signal
        });
        
        // 验证流对象已正确获取
        logger.log('Main', `会话 ${sessionId} 的外部API流请求已创建`);

        // 完整的响应内容
        let fullContent = '';
        // 完整的推理内容
        let fullReasoningContent = '';
        // 需要调用的工具
        let toolCalls: Array<ChatCompletionMessageToolCall> | null = null;
        // 当前调用工具index
        let nowToolCallIndex = -1;
        
        // 持续的流
        const stream = streamResult.stream;

        // 注册中断检测
        apiController.signal.addEventListener('abort', () => {
          logger.log('Main', `会话 ${sessionId} 的外部API流处理已中断，停止处理后续块`);
        });

        try {
          for await (const chunk of stream) {
            // 检查是否已中断
            if (apiController.signal.aborted) {
              logger.log('Main', `会话 ${sessionId} 的外部API流处理已中断，停止处理后续块`);
              break;
            }
            
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
              // 工具名称
              if (
                chunk.choices[0].delta?.tool_calls[0].type === 'function'
                && chunk.choices[0].delta?.tool_calls[0].function.name
              ) {
                // 上一个function名字和参数收集完毕，发送给前端
                if (nowToolCallIndex !== -1 && toolCalls) {
                  sendData(res, { toolCall: toolCalls[nowToolCallIndex] });
                }

                // 工具index+1
                nowToolCallIndex += 1;
                // 赋值
                if (!toolCalls) {
                  toolCalls = [];
                }
                if (!toolCalls[nowToolCallIndex]) {
                  toolCalls[nowToolCallIndex] = chunk.choices[0].delta?.tool_calls[0] as ChatCompletionMessageToolCall;
                }
              }

              // 工具调用参数
              if (chunk.choices[0].delta.tool_calls[0].function
                && !chunk.choices[0].delta?.tool_calls[0].function.name // 排除在工具名称中的参数（qwen）
              ) {
                const addStr = chunk.choices[0].delta.tool_calls[0].function.arguments;
                
                if (addStr && toolCalls && toolCalls[nowToolCallIndex]) {
                  toolCalls[nowToolCallIndex].function.arguments += addStr;
                }
              }
            }
          }

          // 处理最后一个无法发送的情况
          if (toolCalls && toolCalls.length > 0) {
            sendData(res, { toolCall: toolCalls[toolCalls.length - 1] });
          }
        } catch (streamError) {
          // 检查是否是中止错误
          if (streamError instanceof Error && streamError.name === 'AbortError') {
            logger.log('Main', `会话 ${sessionId} 的流循环被中断: ${streamError.message}`);
            sendData(res, { content: "\n\n[生成已停止]" });
          } else {
            logger.error('Main', `会话 ${sessionId} 的流循环发生错误: ${streamError}`);
            throw streamError;
          }
        }

        // 当前session
        const session = client.getSession(sessionId);
        // 信息是否更新
        let isMessageUpdate = false;

        // 检查是否已中断
        if (apiController.signal.aborted) {
          logger.log('Main', `会话 ${sessionId} 的外部API流已处理完所有块，检测到中断状态，不添加消息到会话`);
          // 已中断，不添加消息
          sendData(res, { isMessageUpdate: true });
          endStream(res, { complete: true });
          // 清理会话的控制器
          activeStreamRequests.delete(sessionId);
          return;
        }

        // 文字流
        if (
          (fullContent || fullReasoningContent) &&
          !toolCalls
        ) {
          // 将完整响应添加到会话历史
          session?.addAssistantMessage(fullContent, fullReasoningContent);
          // 信息更新
          isMessageUpdate = true;
        }

        // 有需要调用的工具
        if (toolCalls && toolCalls.length > 0) {
          logger.log('工具调用参数', toolCalls[0].function.arguments);
          // 添加工具调用会话历史
          session?.addAssistantMessage(
            fullContent || '',
            fullReasoningContent || '',
            toolCalls
          );
          // 信息更新
          isMessageUpdate = true;
        }

        if (isMessageUpdate) {
          // 提醒前端更新信息
          sendData(res, { isMessageUpdate: true });
        }

        // 遍历开始调用工具
        if (toolCalls) {
          // 标记会话有活动的工具调用
          activeToolCalls.set(sessionId, true);
          
          for(const toolCall of toolCalls) {
            // 检查是否应该中止工具调用
            if (activeToolCalls.get(sessionId) === false || apiController.signal.aborted) {
              logger.log('Main', `会话 ${sessionId} 的工具调用被用户中止`);
              break;
            }
            
            // 调用工具获取结果
            const toolRes = await callMCPTool(toolCall);

            // 检查是否应该中止后续工具调用
            if (activeToolCalls.get(sessionId) === false || apiController.signal.aborted) {
              logger.log('Main', `会话 ${sessionId} 的后续工具调用被用户中止`);
              break;
            }
            
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
            sendData(res, { isMessageUpdate: true });
          }
          
          // 清理会话的工具调用状态
          activeToolCalls.delete(sessionId);
        }

        // 完成响应
        endStream(res, { complete: true });
        
        // 清理会话的控制器
        activeStreamRequests.delete(sessionId);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // 用户主动终止
          logger.log('Main', `流式请求已被用户中止: ${sessionId}`);
          sendData(res, { 
            content: "\n\n[已停止生成]"
          });
          return;
        } else if (error instanceof Error && (error as Error & { tokenLimitExceeded?: any }).tokenLimitExceeded) {
          // token超限
          sendData(res, {
            error: JSON.stringify(error) 
          });
        } else {
          // 其他错误
          // 如果会话存在，删除不合法的信息
          const session = client.getSession(sessionId);
          if (session) {
            const removed = session.removeUnlegalMessages();
            logger.log('Main', `删除会话 ${sessionId} 的最后一条用户消息: ${removed ? '成功' : '没有找到用户消息'}`);
          }
          logger.error('Main', `流式请求失败: ${error}`);
          sendData(res, { 
            error: `流式请求失败: ${error instanceof Error ? error.message : String(error)}` 
          });
        }
        
        // 清理控制器
        activeStreamRequests.delete(sessionId);
        endStream(res);
      }
    } catch (error) {
      logger.error('Main', `处理流式请求失败: ${error}`);
      sendData(res, { 
        error: `处理流式请求失败: ${error instanceof Error ? error.message : String(error)}` 
      });
      
      // 清理控制器
      activeStreamRequests.delete(sessionId);
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

// 处理停止生成请求
router.post('/api/sessions/:id/stop-generation', (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    logger.log('Main', `收到停止生成请求: ${sessionId}`);
    
    // 标记该会话的工具调用应该被中断
    activeToolCalls.set(sessionId, false);
    
    // 中断正在进行的API流请求
    const controller = activeStreamRequests.get(sessionId);
    if (controller) {
      logger.log('Main', `中断会话 ${sessionId} 的外部API流请求`);
      controller.abort();
      activeStreamRequests.delete(sessionId);
    }
    
    // 获取会话并删除最后一条用户消息
    const providerType = req.query.provider as ProviderType || defaultProviderType;
    const client = AIProviderFactory.getProvider(providerType);
    const session = client.getSession(sessionId);
    
    // 如果会话存在，删除不合法的信息
    if (session) {
      const removed = session.removeUnlegalMessages();
      logger.log('Main', `删除会话 ${sessionId} 的最后一条用户消息: ${removed ? '成功' : '没有找到用户消息'}`);
    }
    
    // 返回成功响应
    res.json({ success: true });
  } catch (error) {
    logger.error('Main', `处理停止生成请求失败: ${error}`);
    res.status(500).json({ 
      error: `处理停止生成请求失败: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
});

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
      preload: preloadExists ? preloadPath : undefined
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
  mainWindow.setTitle('Luna');
  
  // 页面加载完成后更新标题
  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow) {
      mainWindow.setTitle('Luna');
    }
  });

  // 当窗口关闭时触发的事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 注册开发者工具切换处理程序
  ipcMain.handle('window:toggleDevTools', (event) => {
    try {
      // 获取发送请求的窗口
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win) {
        logger.error('Main', '无法找到请求切换开发者工具的窗口');
        return;
      }
      
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools();
        logger.log('Main', '已关闭开发者工具');
      } else {
        win.webContents.openDevTools();
        logger.log('Main', '已打开开发者工具');
      }
    } catch (error) {
      logger.error('Main', `切换开发者工具时发生错误: ${error}`);
    }
  });

  // 注册快捷键处理
  mainWindow.webContents.on('before-input-event', (event, input) => {
    try {
      if (!mainWindow) {
        logger.warn('Main', '主窗口不存在，无法处理快捷键');
        return;
      }
      
      // Command+Option+I (Mac) 或 Ctrl+Shift+I (Windows/Linux)
      const isMac = process.platform === 'darwin';
      const modifierKey = isMac ? input.meta : input.control;
      
      if (modifierKey && input.shift && input.key.toLowerCase() === 'i') {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
          logger.log('Main', '通过快捷键关闭开发者工具');
        } else {
          mainWindow.webContents.openDevTools();
          logger.log('Main', '通过快捷键打开开发者工具');
        }
        event.preventDefault();
      }
    } catch (error) {
      logger.error('Main', `处理开发者工具快捷键时发生错误: ${error}`);
    }
  });

  // 添加菜单项
  const { Menu } = require('electron');
  const isMac = process.platform === 'darwin';
  const template = [
    // 编辑菜单，支持复制/粘贴/剪切/全选等
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
          { role: 'delete', label: '删除' },
          { role: 'selectAll', label: '全选' },
          { type: 'separator' },
          { label: '语音', submenu: [ { role: 'startSpeaking' }, { role: 'stopSpeaking' } ] }
        ] : [
          { role: 'delete', label: '删除' },
          { type: 'separator' },
          { role: 'selectAll', label: '全选' }
        ])
      ]
    },
    // 保留原有视图菜单
    {
      label: '视图',
      submenu: [
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Cmd+Option+I' : 'Ctrl+Shift+I',
          click: () => {
            try {
              if (!mainWindow) {
                logger.warn('Main', '主窗口不存在，无法切换开发者工具');
                return;
              }
              if (mainWindow.webContents.isDevToolsOpened()) {
                mainWindow.webContents.closeDevTools();
                logger.log('Main', '通过菜单关闭开发者工具');
              } else {
                mainWindow.webContents.openDevTools();
                logger.log('Main', '通过菜单打开开发者工具');
              }
            } catch (error) {
              logger.error('Main', `通过菜单切换开发者工具时发生错误: ${error}`);
            }
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// 当Electron初始化完成后调用此方法创建主窗口
app.on('ready', () => {
  // 为所有平台设置应用图标
  const iconPath = path.join(__dirname, '../../src/assets/logo.png');
  try {
    const icon = nativeImage.createFromPath(iconPath);
    
    // macOS平台设置Dock图标
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(icon);
    }
    
    // Windows平台设置应用ID
    if (process.platform === 'win32') {
      app.setAppUserModelId('com.luna.assistant');
    }
  } catch (error) {
    logger.error('Main', `设置应用图标失败: ${error}`);
  }
  
  createWindow();
});

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  // 在macOS上，用户通常希望应用在所有窗口关闭后继续运行直到明确退出
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // 在macOS上，当点击dock图标并且没有其他窗口打开时，通常会重新创建应用窗口
  if (mainWindow === null) {
    createWindow();
  }
});

// 退出前清理
app.on('will-quit', async () => {
  // 关闭MCP服务
  try {
    logger.log('Main', '应用程序退出，关闭MCP服务');
    await mcpClient.stopAllServers();
    logger.log('Main', 'MCP服务已成功关闭');
  } catch (error) {
    logger.error('Main', `关闭MCP服务失败: ${error}`);
  }
  
  // 在应用程序真正退出时关闭Express服务器
  if (server) {
    logger.log('Main', '应用程序退出，关闭Express服务器');
    server.close();
  }
});

// 注册 notification:send handler，支持前端系统通知
ipcMain.handle('notification:send', (event, options) => {
  // options: { title, body, icon, ... }
  const notification = new Notification(options);
  notification.show();
});