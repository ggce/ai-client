import { app, BrowserWindow, ipcMain, dialog, nativeImage } from 'electron';
import * as path from 'path';
import * as url from 'url';
import express, { Request, Response, Application, RequestHandler } from 'express';
import bodyParser from 'body-parser';
import { DeepseekClient } from '../providers/deepseek';
import { AIProviderSwitcher } from '../ai-provider-switcher';
import dotenv from 'dotenv';
import * as fs from 'fs';
import { OpenAIClient } from '../providers/openai';

// 加载环境变量
dotenv.config();

// 设置应用名称
app.name = 'DeepSeek客户端';

// 设置Express服务器
const expressApp = express();
const PORT = process.env.PORT || 3001; // 修改为3001避免与Vue开发服务器冲突

// 初始化API客户端
const deepseekClient = new DeepseekClient();
const providerSwitcher = new AIProviderSwitcher({
  defaultProvider: process.env.DEFAULT_PROVIDER || 'deepseek',
  providers: ['deepseek', 'openai']
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

// 主页路由 - 使用Vue应用代替EJS模板
expressApp.get('/', (req: Request, res: Response) => {
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
});

// 处理聊天请求的API端点
const chatHandler = async (req: Request, res: Response) => {
  try {
    const { message, provider, config, model } = req.body;
    
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

      response = await dynamicClient.chat.completions.create({
        model: model || 'deepseek-chat',
        messages: [
          { role: 'user', content: message }
        ]
      });
    } else if (provider === 'openai') {
      // 使用用户配置创建OpenAI客户端
      const dynamicClient = new OpenAIClient({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || undefined
      });

      response = await dynamicClient.chat.completions.create({
        model: model || 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: message }
        ]
      });
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
expressApp.post('/api/chat', (req: Request, res: Response) => {
  chatHandler(req, res).catch(error => {
    console.error('处理聊天请求时出错:', error);
    res.status(500).json({ 
      error: '处理请求时出错', 
      details: error instanceof Error ? error.message : String(error) 
    });
  });
});

// 注册流式API路由 - 使用SSE标准
expressApp.post('/api/chat/stream', (async (req: Request, res: Response) => {
  try {
    const { message, provider, model, config } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    if (!provider) {
      return res.status(400).json({ error: '未指定AI提供商' });
    }

    if (!config || !config.apiKey) {
      return res.status(400).json({ error: 'API密钥未配置' });
    }
    
    // 设置响应头以支持Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    
    // 标记连接是否已完成
    let isCompleted = false;
    
    const sendData = (data: string) => {
      if (!res.writableEnded && !isCompleted) {
        console.log('发送SSE数据:', data);
        // 确保格式正确: 每条消息以data:开头，以两个换行符结尾
        res.write(`data: ${data}\n\n`);
      }
    };
    
    const handleError = (error: any) => {
      console.error('流式输出错误:', error);
      if (!isCompleted) {
        sendData(JSON.stringify({ error: String(error) }));
        sendData('[DONE]');
        isCompleted = true;
        res.end();
      }
    };
    
    const cleanupConnection = () => {
      if (!isCompleted) {
        isCompleted = true;
        if (!res.writableEnded) {
          try {
            sendData('[DONE]');
            res.end();
          } catch (endError) {
            console.error('结束响应流时出错:', endError);
          }
        }
      }
    };
    
    // 根据提供商创建相应的客户端并调用流式API
    const processStream = async () => {
      try {
        if (provider === 'deepseek') {
          // 使用用户配置创建Deepseek客户端
          const dynamicClient = new DeepseekClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || undefined
          });
          
          try {
            // 打印请求参数，方便调试
            const modelName = model || 'deepseek-chat';
            console.log('请求Deepseek API，参数:', {
              model: modelName,
              messages: [{ role: 'user', content: message }],
              stream: true
            });
            
            // 使用模型名称，不需要修改
            // 根据DeepSeek官方文档，deepseek-chat用于V3，deepseek-reasoner用于R1
            const correctedModel = modelName;
            
            // 使用更多请求参数，确保兼容性
            const stream = await dynamicClient.chat.completions.createStream({
              model: correctedModel,
              messages: [{ role: 'user', content: message }],
              stream: true,
              temperature: 0.7,
              max_tokens: 2048
            });
            
            console.log(`开始Deepseek流式响应, 模型: ${correctedModel}`);
            
            // 设置计数器以跟踪响应
            let chunkCount = 0;
            let totalContent = '';
            
            for await (const chunk of stream) {
              if (isCompleted) break;
              
              chunkCount++;
              
              // 直接打印原始响应数据
              console.log(`Deepseek流块 #${chunkCount}:`, JSON.stringify(chunk, null, 2));
              
              // 将Deepseek格式转换为前端期望的统一格式
              let formattedChunk;
              
              // 检查Deepseek返回数据的格式
              if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
                // 已经是OpenAI类似格式
                formattedChunk = chunk;
                const content = chunk.choices[0].delta.content;
                if (content) {
                  console.log(`【Deepseek-OpenAI格式 #${chunkCount}】收到内容:`, content);
                  totalContent += content;
                }
              } else {
                // 从Deepseek特有格式转换成类似OpenAI的格式
                const content = chunk.content || '';
                console.log(`【Deepseek特有格式 #${chunkCount}】收到内容:`, content);
                totalContent += content;
                
                formattedChunk = {
                  choices: [{
                    delta: {
                      content: content
                    }
                  }]
                };
              }
              
              // 只在有内容时发送
              if (formattedChunk.choices[0].delta.content) {
                console.log('向前端发送数据:', formattedChunk.choices[0].delta.content);
                sendData(JSON.stringify(formattedChunk));
              } else {
                console.log('跳过空内容');
              }
            }
            
            console.log(`Deepseek流式响应完成，共收到${chunkCount}个数据块，总内容长度: ${totalContent.length}字符`);
            if (chunkCount === 0) {
              console.log('警告: 未收到任何数据块，可能存在API问题');
              // 如果没有收到任何内容，提供一个反馈给用户
              sendData(JSON.stringify({
                choices: [{
                  delta: {
                    content: '抱歉，AI服务未能提供回复。请检查API设置或稍后再试。'
                  }
                }]
              }));
            }
          } catch (streamError) {
            console.error('处理Deepseek流式输出错误:', streamError);
            sendData(JSON.stringify({ 
              error: `Deepseek流式输出错误: ${streamError instanceof Error ? streamError.message : String(streamError)}` 
            }));
          }
          
          cleanupConnection();
        } 
        else if (provider === 'openai') {
          // 使用用户配置创建OpenAI客户端
          const dynamicClient = new OpenAIClient({
            apiKey: config.apiKey,
            baseUrl: config.baseUrl || undefined
          });
          
          try {
            console.log(`开始OpenAI流式响应, 模型: ${model || 'gpt-3.5-turbo'}`);
            
            // 使用OpenAI的createStream方法
            const stream = await dynamicClient.chat.completions.createStream({
              model: model || 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: message }]
            });
            
            // OpenAI流是AsyncIterable
            for await (const chunk of stream) {
              if (isCompleted) break;
              
              // 直接打印原始响应数据
              console.log('OpenAI流式原始数据:', JSON.stringify(chunk, null, 2));
              
              // 将OpenAI格式转换为通用格式
              const formattedChunk = {
                choices: [{
                  delta: {
                    content: chunk.choices[0]?.delta?.content || ''
                  }
                }]
              };
              
              const content = formattedChunk.choices[0].delta.content;
              
              // 只在有内容时发送
              if (content) {
                console.log('【OpenAI】收到内容:', content);
                console.log('向前端发送数据:', content);
                sendData(JSON.stringify(formattedChunk));
              } else {
                console.log('跳过空内容');
              }
            }
            
            console.log('OpenAI流式响应完成');
          } catch (streamError) {
            console.error('处理OpenAI流式输出错误:', streamError);
            sendData(JSON.stringify({ 
              error: `OpenAI流式输出错误: ${streamError instanceof Error ? streamError.message : String(streamError)}` 
            }));
          }
          
          cleanupConnection();
        } 
        else {
          handleError('不支持的AI提供商');
        }
      } catch (error) {
        handleError(error);
      }
    };
    
    // 启动流式处理
    processStream();
    
    // 当客户端断开连接时处理
    req.on('close', () => {
      if (!isCompleted) {
        console.log('客户端断开连接 - 时间:', new Date().toISOString());
        cleanupConnection();
      }
    });
    
    // 设置超时以防止连接挂起
    const timeoutId = setTimeout(() => {
      if (!isCompleted) {
        console.log('流式连接超时');
        sendData(JSON.stringify({ error: '连接超时，请重试' }));
        cleanupConnection();
      }
    }, 60000); // 增加到60秒超时
    
    // 当响应结束时清除超时
    res.on('close', () => {
      clearTimeout(timeoutId);
    });
  } 
  catch (error) {
    console.error('流式API处理错误:', error);
    res.status(500).json({ 
      error: '处理请求时出错', 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
}) as RequestHandler);

// 配置API路由 - 获取配置
expressApp.get('/api/config', (req: Request, res: Response) => {
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
});

// 配置API路由 - 保存配置
expressApp.post('/api/config', (req: Request, res: Response) => {
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
});

// 处理所有其他GET请求 - 支持Vue的路由模式
expressApp.use((req: Request, res: Response, next) => {
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
});

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