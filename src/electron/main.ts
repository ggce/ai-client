import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import * as url from 'url';
import express from 'express';
import { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import { DeepseekClient } from '../providers/deepseek';
import { AIProviderSwitcher } from '../ai-provider-switcher';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { OpenAIClient } from '../providers/openai';
import { Message, Role } from '../types';

// 加载环境变量
dotenv.config();

// 设置应用名称
app.name = 'DeepSeek客户端';

// 设置Express服务器
const expressApp = express();
const PORT = process.env.PORT || 3001; // 修改为3001避免与Vue开发服务器冲突

// 创建API客户端实例
const deepseekClient = new DeepseekClient({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
  baseUrl: process.env.DEEPSEEK_API_BASE_URL
});

const openaiclient = new OpenAIClient({
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_API_BASE_URL
});

// 设置静态文件夹 - 提供API服务
expressApp.use(express.static(path.join(__dirname, '../../src/public')));

// 设置Vue构建输出的静态文件夹
expressApp.use(express.static(path.join(__dirname, '../../vue-client/dist')));

// 设置模板引擎
expressApp.set('view engine', 'ejs');
expressApp.set('views', path.join(__dirname, '../../src/views'));

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

// 处理聊天请求的API端点
const chatHandler = async (req: Request, res: Response) => {
  try {
    const { message, provider, config, model, conversationId, conversationHistory } = req.body;
    
    // 添加调试日志 - 打印接收到的请求详情
    console.log('收到聊天请求:', { 
      provider, 
      model, 
      messageLength: message?.length,
      hasConversationHistory: !!conversationHistory,
      conversationHistoryLength: conversationHistory?.length || 0
    });
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      console.log('对话历史摘要:', conversationHistory.map(msg => ({
        type: msg.type,
        contentPreview: msg.content.substring(0, 30) + '...'
      })));
    }
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    if (!provider) {
      return res.status(400).json({ error: '未指定AI提供商' });
    }

    if (!config || !config.apiKey) {
      return res.status(400).json({ error: 'API密钥未配置' });
    }

    let response;
    
    if (provider === 'deepseek') {
      // 使用用户配置创建Deepseek客户端
      const dynamicClient = new DeepseekClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || undefined
      });

      // 处理多轮对话
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        // 将历史消息格式化为DeepSeek需要的格式 - 使用正确的类型
        const messages: Message[] = conversationHistory.map(msg => {
          // 将UI消息类型转换为API所需的Role类型
          let role: Role = 'user';
          if (msg.type === 'ai') role = 'assistant';
          else if (msg.type === 'system') role = 'system';
          
          return {
            role: role,
            content: msg.content
          };
        });
        
        // 添加当前用户消息
        messages.push({ role: 'user', content: message });
        
        // 特殊处理: 对于DeepSeek Reasoner模型，需要确保消息是严格交替的
        if (model === 'deepseek-reasoner') {
          console.log('检测到Reasoner模型，进行消息交替检查');
          
          // 创建一个新的消息数组，确保严格交替
          const filteredMessages: Message[] = [];
          let lastRole: Role | null = null;
          
          for (const msg of messages) {
            // 跳过与前一条消息角色相同的消息（防止连续相同角色消息）
            if (lastRole === msg.role) {
              console.log(`跳过连续的${msg.role}消息:`, msg.content.substring(0, 30) + '...');
              continue;
            }
            
            // 添加到过滤后的消息中
            filteredMessages.push(msg);
            lastRole = msg.role;
          }
          
          // 替换原始消息数组
          console.log('过滤前消息数量:', messages.length, '过滤后:', filteredMessages.length);
          console.log('过滤后的消息序列:', filteredMessages.map(m => m.role).join(' -> '));
          
          // 使用过滤后的消息
          response = await dynamicClient.chat.completions.create({
            model: model || 'deepseek-reasoner',
            messages: filteredMessages
          });
        } else {
          // 输出调试信息
          console.log('发送给DeepSeek的完整消息历史:', JSON.stringify(messages));
          
          // 发送带历史的请求
          response = await dynamicClient.chat.completions.create({
            model: model || 'deepseek-chat',
            messages: messages
          });
        }
      } else {
        // 单轮对话 - 向后兼容
        response = await dynamicClient.chat.completions.create({
          model: model || 'deepseek-chat',
          messages: [
            { role: 'user', content: message }
          ]
        });
      }
    } else if (provider === 'openai') {
      // 使用用户配置创建OpenAI客户端
      const dynamicClient = new OpenAIClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || undefined
      });

      // 处理多轮对话
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        // 将历史消息格式化为OpenAI需要的格式 - 使用正确的类型
        const messages: Message[] = conversationHistory.map(msg => {
          // 将UI消息类型转换为API所需的Role类型
          let role: Role = 'user';
          if (msg.type === 'ai') role = 'assistant';
          else if (msg.type === 'system') role = 'system';
          
          return {
            role: role,
            content: msg.content
          };
        });
        
        // 添加当前用户消息
        messages.push({ role: 'user', content: message });
        
        // 输出调试信息
        console.log('发送给OpenAI的完整消息历史:', JSON.stringify(messages));
        
        // 发送带历史的请求
        response = await dynamicClient.chat.completions.create({
          model: model || 'gpt-3.5-turbo',
          messages: messages
        });
      } else {
        // 单轮对话 - 向后兼容
        response = await dynamicClient.chat.completions.create({
          model: model || 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: message }
          ]
        });
      }
    } else {
      return res.status(400).json({ error: '不支持的AI提供商' });
    }

    res.json({ 
      reply: response.choices[0].message.content,
      rawResponse: response
    });
  } catch (error) {
    console.error('API请求失败:', error);
    res.status(500).json({ 
      error: '处理请求时出错', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
};

// 聊天API路由
router.post('/api/chat', routeHandler((req: Request, res: Response) => {
  chatHandler(req, res).catch(error => {
    console.error('处理聊天请求时出错:', error);
    res.status(500).json({ 
      error: '处理请求时出错', 
      details: error instanceof Error ? error.message : String(error) 
    });
  });
}));

// 处理所有路由 - 使用类型断言避免TypeScript编译错误
interface RouterHandler {
  (req: Request, res: Response): void;
}

interface MiddlewareHandler {
  (req: Request, res: Response, next: NextFunction): void;
}

function routeHandler(handler: RouterHandler) {
  return handler as any; // 类型断言为any避免TypeScript错误
}

function middlewareHandler(handler: MiddlewareHandler) {
  return handler as any; // 类型断言为any避免TypeScript错误
}

// 注册流式API路由 - 使用SSE标准
router.post('/api/chat/stream', routeHandler((req: Request, res: Response) => {
  const { message, provider = 'deepseek', config, model = 'deepseek-chat', conversationHistory } = req.body;

  console.log(`开始${provider}流式响应, 模型: ${model}`);
  
  // 添加调试日志
  console.log('接收到流式请求:', {
    provider,
    model,
    messageLength: message?.length,
    hasConversationHistory: !!conversationHistory,
    conversationHistoryLength: conversationHistory?.length || 0
  });
  
  if (conversationHistory && Array.isArray(conversationHistory)) {
    console.log('流式对话历史摘要:', conversationHistory.map(msg => ({
      type: msg.type,
      contentPreview: msg.content.substring(0, 30) + '...'
    })));
  }
  
  // 基本参数验证
  if (!message) {
    return res.status(400).json({ error: '消息不能为空' });
  }
  
  // 设置SSE响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // 创建计数器和内容
  let chunkCount = 0;
  let accumulatedContent = '';

  // 使用立即执行异步函数，而不是在主处理程序中使用async
  (async function() {
    try {
      // 根据provider创建不同的client
      let dynamicClient; 
      
      if (provider === 'deepseek') {
        dynamicClient = new DeepseekClient({
          apiKey: config?.apiKey || process.env.DEEPSEEK_API_KEY || '',
          baseUrl: config?.baseUrl || process.env.DEEPSEEK_API_BASE_URL
        });
      } else {
        dynamicClient = new OpenAIClient({
          apiKey: config?.apiKey || process.env.OPENAI_API_KEY || '',
          baseUrl: config?.baseUrl || process.env.OPENAI_API_BASE_URL
        });
      }
      
      // 准备消息数组 - 使用正确的类型
      let messages: Message[] = [];
      
      // 处理多轮对话
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        // 将历史消息格式化为API需要的格式
        messages = conversationHistory.map(msg => {
          // 将UI消息类型转换为API所需的Role类型
          let role: Role = 'user';
          if (msg.type === 'ai') role = 'assistant';
          else if (msg.type === 'system') role = 'system';
          
          return {
            role: role,
            content: msg.content
          };
        });
        
        // 输出调试日志
        console.log('流式会话历史已转换, 条数:', messages.length);
      }
      
      // 添加当前用户消息
      messages.push({ role: 'user', content: message });
      
      // 特殊处理: 对于DeepSeek Reasoner模型，需要确保消息是严格交替的
      if (provider === 'deepseek' && model === 'deepseek-reasoner') {
        console.log('流式请求检测到Reasoner模型，进行消息交替检查');
        
        // 创建一个新的消息数组，确保严格交替
        const filteredMessages: Message[] = [];
        let lastRole: Role | null = null;
        
        for (const msg of messages) {
          // 跳过与前一条消息角色相同的消息（防止连续相同角色消息）
          if (lastRole === msg.role) {
            console.log(`跳过连续的${msg.role}消息:`, msg.content.substring(0, 30) + '...');
            continue;
          }
          
          // 添加到过滤后的消息中
          filteredMessages.push(msg);
          lastRole = msg.role;
        }
        
        // 替换原始消息数组
        console.log('过滤前消息数量:', messages.length, '过滤后:', filteredMessages.length);
        console.log('过滤后的消息序列:', filteredMessages.map(m => m.role).join(' -> '));
        
        // 使用过滤后的消息
        messages = filteredMessages;
      }
      
      // 打印完整发送的消息
      console.log('发送给API的完整消息历史:', JSON.stringify(messages));
      
      // 创建流
      const stream = await dynamicClient.chat.completions.createStream({
        model: model,
        messages: messages,
        max_tokens: 2048,
        temperature: 0.7
      });
      
      console.log(`流创建成功, 准备处理数据`);

      // 处理流数据的函数
      async function processStream() {
        try {
          // 确保stream是异步迭代器
          if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
            throw new Error(`流对象不是有效的异步迭代器: ${typeof stream}`);
          }
          
          for await (const chunk of stream) {
            // 深度检查chunk对象的结构
            console.log(`收到数据块类型: ${typeof chunk}`, 
              chunk?.choices ? `包含choices: ${chunk.choices.length}` : '无choices');
            
            // 获取每个chunk的内容
            const content = chunk.choices[0]?.delta?.content || '';
            
            if (content) {
              chunkCount++;
              accumulatedContent += content;
              
              // 发送数据给客户端
              const data = { content };
              sendData(res, data);
            }
          }
          
          // 流结束，记录统计信息
          console.log(`${provider}流式响应完成，共收到${chunkCount}个数据块，总内容长度: ${accumulatedContent.length}字符`);
          
          // 如果没有收到任何内容，发送警告
          if (chunkCount === 0) {
            console.warn('警告: 未收到任何数据块，可能存在API问题');
            sendData(res, { error: '未能获取到有效回复，请检查API配置' });
          }
          
          // 结束响应
          res.end();
        } catch (error: any) {
          console.error(`流处理错误:`, error);
          sendData(res, { error: `流处理出错: ${error.message}` });
          res.end();
        }
      }
      
      // 启动流处理
      await processStream();
    } catch (error: any) {
      console.error(`创建流失败:`, error);
      sendData(res, { error: `创建流失败: ${error.message}` });
      res.end();
    }
  })().catch((error: any) => {
    console.error('处理流时发生错误:', error);
    sendData(res, { error: `处理出错: ${error.message}` });
    res.end();
  });
}));

// 格式化发送数据的辅助函数
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