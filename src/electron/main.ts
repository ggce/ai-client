import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import * as url from 'url';
import express, { Request, Response, Express, Application } from 'express';
import { NextFunction } from 'express';
import bodyParser from 'body-parser';
import { DeepseekClient } from '../providers/deepseek';
import { AIProviderSwitcher } from '../ai-provider-switcher';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { OpenAIClient } from '../providers/openai';
import { Message, Role } from '../types';
import { DEEPSEEK_DEFAULT_URL, OPENAI_DEFAULT_URL, OPENAI_MODELS, DEEPSEEK_MODELS } from '../constants';

// 加载环境变量
dotenv.config();

// 设置应用名称
app.name = 'AI-CLIENT';

// 设置Express服务器
const expressApp: Application = express();
const PORT = process.env.PORT || 3001; // 修改为3001避免与Vue开发服务器冲突

// 创建API客户端实例（初始化时使用默认值）
let deepseekClient: DeepseekClient = new DeepseekClient({
  apiKey: '',
  baseURL: DEEPSEEK_DEFAULT_URL
});

let openaiclient = new OpenAIClient({
  apiKey: '',
  baseURL: OPENAI_DEFAULT_URL
});

// 从配置文件加载配置
function initClientsFromConfig() {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      console.log('读取到的配置:', JSON.stringify(config, null, 2).substring(0, 100) + '...');
      
      if (config.providers) {
        // 更新DeepSeek客户端
        if (config.providers.deepseek?.apiKey) {
          deepseekClient.updateOptions({
            apiKey: config.providers.deepseek.apiKey,
            baseURL: config.providers.deepseek.baseURL || DEEPSEEK_DEFAULT_URL,
            defaultModel: config.providers.deepseek.model || DEEPSEEK_MODELS.DEFAULT
          });
          console.log('已从配置文件加载DeepSeek API配置');
        }
        
        // 更新OpenAI客户端
        if (config.providers.openai?.apiKey) {
          openaiclient.updateOptions({
            apiKey: config.providers.openai.apiKey,
            baseURL: config.providers.openai.baseURL || OPENAI_DEFAULT_URL,
            defaultModel: config.providers.openai.model || OPENAI_MODELS.DEFAULT
          });
          console.log('已更新OpenAI API配置');
        }
      }
    }
  } catch (error) {
    console.error('从配置文件初始化客户端失败:', error);
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

// 主页路由 - 使用Vue应用代替EJS模板
router.get('/', routeHandler((req: Request, res: Response) => {
  // 检查Vue构建文件是否存在
  const vueDist = path.join(__dirname, '../../vue-client/dist/index.html');
  
  // 确保Vue dist目录存在
  const vueDistDir = path.join(__dirname, '../../vue-client/dist');
  if (!fs.existsSync(vueDistDir)) {
    try {
      fs.mkdirSync(vueDistDir, { recursive: true });
      console.log('创建了Vue dist目录:', vueDistDir);
    } catch (error) {
      console.error('创建Vue dist目录失败:', error);
    }
  }
  
  if (fs.existsSync(vueDist)) {
    // 提供Vue构建的HTML文件
    res.sendFile(vueDist);
  } else {
    // 如果Vue构建不存在，回退到EJS模板
    console.warn('Vue应用构建不存在，使用EJS模板替代');
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
      console.error('路由处理错误:', error);
      
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
    console.log('读取配置文件:', configPath);
    
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      console.log('配置加载成功');
      res.json(config);
    } else {
      console.log('配置文件不存在，返回空配置');
      res.json({});
    }
  } catch (error) {
    console.error('读取配置失败:', error);
    res.status(500).json({ error: '读取配置失败' });
  }
}));

// 配置API路由 - 保存配置
router.post('/api/config', routeHandler((req: Request, res: Response) => {
  try {
    // 保存配置到文件
    const configPath = path.join(app.getPath('userData'), 'config.json');
    console.log('保存配置到文件:', configPath);
    console.log('配置内容:', JSON.stringify(req.body));
    
    // 确保目录存在
    const configDir = path.dirname(configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    
    // 从配置文件加载配置
    initClientsFromConfig();

    console.log('配置保存成功');
    res.json({ success: true });
  } catch (error) {
    console.error('保存配置失败:', error);
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
      console.error('查询DeepSeek余额失败:', response.status, errorData);
      return res.status(response.status).json({ 
        error: '查询余额失败', 
        status: response.status,
        details: errorData
      });
    }
    
    // 返回余额信息
    const balanceData = await response.json();
    console.log('DeepSeek余额信息:', balanceData);
    res.json(balanceData);
  } catch (error) {
    console.error('查询DeepSeek余额错误:', error);
    res.status(500).json({ 
      error: '查询余额失败', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}));

// 会话管理API

// 创建新会话
router.post('/api/sessions', routeHandler(async (req: Request, res: Response) => {
  console.log('接收到创建会话请求', req.body);
  try {
    console.log('准备创建会话');
    
    // 使用新的API创建会话
    const sessionId = deepseekClient.createSession();
    
    if (!sessionId) {
      console.error('创建会话失败');
      // 直接发送响应而不是返回值
      res.status(500).json({ error: '创建会话失败: 未返回sessionId' });
      return;
    }
    
    console.log('成功创建会话，ID:', sessionId);
    
    // 直接发送响应
    res.json(sessionId);
  } catch (err) {
    console.error('创建会话失败', err);
    // 直接发送错误响应
    res.status(500).json({
      error: `创建会话失败: ${err instanceof Error ? err.message : String(err)}`
    });
  }
}));

// 获取会话id列表
router.get('/api/sessionIds', routeHandler(async (req: Request, res: Response) => {
  console.log('接收到获取会话id列表请求');
  try {
    // 设置超时处理
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('获取会话id列表超时')), 5000);
    });
    
    const getSessionsPromise = (async () => {
      try {
        console.log('准备获取会话id列表');
        // 使用新的API获取会话列表
        const sessionIds = deepseekClient.listSessionIds();
        console.log(`找到 ${sessionIds.length} 个会话`);
        
        // 转换为前端需要的格式
        console.log('成功获取会话id列表', sessionIds);
        return sessionIds;
      } catch (innerErr) {
        console.error('获取会话id列表内部错误', innerErr);
        throw new Error(`获取会话id列表内部错误: ${innerErr instanceof Error ? innerErr.message : String(innerErr)}`);
      }
    })();
    
    // 使用Promise.race防止请求卡住
    return await Promise.race([getSessionsPromise, timeoutPromise]);
  } catch (err) {
    console.error('获取会话id列表失败', err);
    // 返回空列表，允许前端继续
    return [];
  }
}));

// 获取会话历史
router.get('/api/sessions/:id', routeHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    
    // 使用新的API获取会话历史
    try {
      const messages = deepseekClient.getSessionMessages(sessionId);
      
      // 转换消息格式以适应前端需求
      const formattedMessages = messages.map(msg => ({
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
    console.error('获取会话历史失败', err);
    throw new Error(`获取会话历史失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}));

// 发送消息到会话
router.post('/api/sessions/:id/messages', routeHandler(async (req: Request, res: Response) => {
  try {
    const { message, options } = req.body;
    const sessionId = req.params.id;
    
    // 使用新的API发送消息
    try {
      const result = await deepseekClient.sendMessageToSession(
        sessionId,
        message,
        options
      );

      // 返回结果
      return {
        content: result.content,
        role: 'assistant',
        reasoningContent: result.reasoningContent
      };
    } catch (error) {
      if (error instanceof Error && error.message === '会话不存在') {
        throw new Error('会话不存在');
      }
      throw error;
    }
  } catch (err) {
    console.error('发送消息失败', err);
    throw new Error(`发送消息失败: ${err instanceof Error ? err.message : String(err)}`);
  }
}));

// 添加一个临时存储来保存消息请求，用于流式接口
const streamRequestsStore: Map<string, { message: string, options?: any }> = new Map();

// 为SSE格式化并发送数据
function sendData(res: Response, data: any) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  // 使用兼容的方式尝试刷新流
  try {
    // 某些Express环境支持flush，但不在类型定义中
    const response = res as any;
    if (typeof response.flush === 'function') {
      response.flush();
    }
  } catch (error) {
    // 忽略刷新错误
  }
}

// 接收流式请求数据
router.post('/api/sessions/:id/messages/stream', (req: Request, res: Response) => {
  try {
    const { message, options } = req.body;
    const sessionId = req.params.id;
    
    // 存储请求数据，以便GET请求处理
    const requestId = `${sessionId}_${Date.now()}`;
    streamRequestsStore.set(requestId, { message, options });
    
    // 设置过期时间，60秒后自动清理
    setTimeout(() => {
      streamRequestsStore.delete(requestId);
      console.log(`已清理流式请求数据: ${requestId}`);
    }, 60000);
    
    // 返回请求ID
    res.json({ requestId });
  } catch (error) {
    console.error('准备流式请求失败:', error);
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
  res.flushHeaders();
  
  const sessionId = req.params.id;
  const { message, options } = requestData;
  
  (async () => {
    try {
      if (!deepseekClient) {
        sendData(res, { error: 'API client not initialized' });
        res.end();
        return;
      }
      
      try {
        // 使用新的流式API
        const streamResult = await deepseekClient.sendStreamMessageToSession(
          sessionId, 
          message,
          options
        );
        
        const stream = streamResult.stream;
        for await (const chunk of stream) {
          if (chunk.choices && chunk.choices[0]?.delta?.content) {
            const content = chunk.choices[0].delta.content;
            sendData(res, { content });
          }
          
          // 处理推理内容（如果有）
          if (chunk.choices && 
              chunk.choices[0]?.delta && 
              'reasoning_content' in chunk.choices[0].delta) {
            const reasoningContent = chunk.choices[0].delta.reasoning_content as string;
            if (reasoningContent) {
              sendData(res, { reasoningContent });
            }
          }
        }
        
        // 注册完成回调
        if (streamResult.onComplete) {
          streamResult.onComplete((finalResponse) => {
            console.log('Stream session complete, final response length:', finalResponse.content.length);
          });
        }
        
        // 发送完成信号并清理
        sendData(res, { done: true });
        streamRequestsStore.delete(requestId);
        res.end();
      } catch (error) {
        if (error instanceof Error && error.message === '会话不存在') {
          sendData(res, { error: 'Session not found' });
          streamRequestsStore.delete(requestId);
          res.end();
          return;
        }
        throw error;
      }
    } catch (err: any) {
      console.error('Failed to send streaming message:', err);
      sendData(res, { error: `Streaming error: ${err.message}` });
      streamRequestsStore.delete(requestId);
      res.end();
    }
  })();
});

// 删除会话
router.delete('/api/sessions/:id', routeHandler(async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    // 使用新的API结束会话
    const success = deepseekClient.endSession(sessionId);
    if (!success) {
      throw new Error('会话不存在');
    }
    return { success: true };
  } catch (err) {
    console.error('删除会话失败', err);
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
    console.warn(`Vue应用构建不存在，无法处理路由: ${req.path}`);
    res.status(404).send('Vue应用未构建，请先运行 npm run vue:build');
  }
}));

// 启动Express服务器
let server = expressApp.listen(PORT, () => {
  console.log(`Express服务器运行在 http://localhost:${PORT}`);
});

// 保存对主窗口的引用，避免被JavaScript的GC机制回收
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // 获取preload脚本路径
  const preloadPath = path.join(__dirname, 'preload.js');
  const preloadExists = fs.existsSync(preloadPath);
  
  if (!preloadExists) {
    console.warn(`警告: Preload脚本不存在: ${preloadPath}`);
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
    width: 1000,
    height: 800,
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
    console.log(`加载开发服务器: ${process.env.VUE_DEV_SERVER_URL}`);
    mainWindow.loadURL(process.env.VUE_DEV_SERVER_URL);
  } else {
    // 尝试加载Express服务器上的页面
    const serverUrl = `http://localhost:${PORT}`;
    console.log(`加载Express服务: ${serverUrl}`);
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
      console.error('设置Dock图标失败:', error);
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