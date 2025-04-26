import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import { 
  ClientOptions,
  Message,
  MCPTool,
  CompletionRequest,
  CompletionResponse
} from '../types';
import { withRetry, generateUUID } from '../utils';
import logger from '../logger';

// 会话管理类 - 通用实现
export class Session {
  private id: string;
  private messages: Message[] = [];
  
  constructor(private loggerPrefix: string = 'BaseClient') {
    this.id = generateUUID();
    
    // 添加系统消息到对话历史的开头
    this.addSystemMessage('开启了新会话');
  }
  
  // 添加系统消息
  public addSystemMessage(content: string): void {
    const message: Message = {
      role: 'system',
      content
    }

    this.messages.push(message);

    logger.log(this.loggerPrefix, '添加 [system] message');
    logger.log(this.loggerPrefix, message);
  }
  
  // 添加用户消息
  public addUserMessage(content: string): void {
    const message: Message = {
      role: 'user',
      content
    }

    this.messages.push(message);

    logger.log(this.loggerPrefix, '添加 [user] message');
    logger.log(this.loggerPrefix, message);
  }
  
  // 添加助手消息
  public addAssistantMessage(content: string, reasoningContent?: string, tool_calls?: Array<ChatCompletionMessageToolCall>): void {
    const message: Message = {
      role: 'assistant',
      content,
      tool_calls,
      reasoningContent
    }

    this.messages.push(message);

    logger.log(this.loggerPrefix, '添加 [assistant] message');
    logger.log(this.loggerPrefix, message);
  }
  
  // 添加工具消息
  public addToolMessage(tool_call_id: string, content: string): void {
    const message: Message = {
      role: 'tool',
      content,
      tool_call_id,
      timestamp: Date.now()
    };
    this.messages.push(message);

    logger.log(this.loggerPrefix, '添加 [tool] message');
    logger.log(this.loggerPrefix, message);
  }

  // 获取会话ID
  public getId(): string {
    return this.id;
  }
  
  // 获取所有消息
  public getMessages(): Message[] {
    return this.messages;
  }
  
  // 检查并删除最后一条用户消息，如果存在
  public removeLastMessageIfUser(): boolean {
    if (this.messages.length === 0) {
      return false;
    }
    
    // 从后向前查找最后一条用户消息的索引
    let lastUserMessageIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'user') {
        lastUserMessageIndex = i;
        break;
      }
    }
    
    // 如果找到了用户消息
    if (lastUserMessageIndex !== -1) {
      // 记录删除信息
      const deletedCount = this.messages.length - lastUserMessageIndex;
      
      // 删除该用户消息及其后所有消息
      this.messages = this.messages.slice(0, lastUserMessageIndex);
      
      logger.log(this.loggerPrefix, `删除最后一条 [user] message 及其后的所有消息，共 ${deletedCount} 条`);
      return true;
    }
    
    return false;
  }
}

// 基础客户端类
export abstract class BaseClient {
  protected client: OpenAI;
  protected options: ClientOptions;
  protected sessions: Map<string, Session> = new Map();
  protected loggerPrefix: string;

  constructor(options: ClientOptions = {}, loggerPrefix: string) {
    this.loggerPrefix = loggerPrefix;
    this.options = {
      apiKey: options.apiKey || '',
      baseURL: options.baseURL || '',
      defaultModel: options.defaultModel || '',
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    };

    // 创建OpenAI客户端实例
    this.client = new OpenAI({
      apiKey: this.options.apiKey || 'dummy-key',
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries,
    });
    
    logger.log(this.loggerPrefix, '初始化客户端完成');
  }

  // 更新options
  public updateOptions(options: Partial<ClientOptions>) {
    // 更新客户端选项
    Object.keys(options).forEach(key => {
      const k = key as keyof ClientOptions;
      if (options[k] !== undefined) {
        this.options[k] = options[k] as any;
      }
    });
    
    // 重新创建OpenAI客户端实例
    this.client = new OpenAI({
      apiKey: this.options.apiKey || 'dummy-key',
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries
    });
    
    logger.log(this.loggerPrefix, `已更新客户端配置: ${JSON.stringify(this.options)}`);
  }

  // 创建新的会话
  public createSession(): string {
    const session = new Session(this.loggerPrefix);
    const sessionId = session.getId();
    logger.log(this.loggerPrefix, `创建新会话: ${sessionId}`);
    this.sessions.set(sessionId, session);

    return sessionId;
  }
  
  // 获取会话
  public getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }
  
  // 删除会话
  public deleteSession(id: string): boolean {
    return this.sessions.delete(id);
  }

  // 结束并删除会话
  public endSession(sessionId: string): boolean {
    return this.deleteSession(sessionId);
  }

  // 列出所有会话ID
  public listSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 获取特定会话的全部消息
   */
  public getSessionMessages(sessionId: string): Array<Message> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    return session.getMessages();
  }

  /**
   * 向会话发送流式消息并获取流式回复
   */
  public async sendStreamMessageToSession(params: {
    sessionId: string, 
    message?: string, 
    options?: {
      model?: string;
    },
    mcpTools?: Array<MCPTool>,
    signal?: AbortSignal
  }) {
    const session = this.getSession(params.sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    return await this.continueSessionStream({
      session,
      message: params.message,
      options: params.options,
      mcpTools: params.mcpTools,
      signal: params.signal
    });
  }

  // 准备会话请求共享逻辑
  protected async prepareSessionRequest(
    session: Session, 
    message?: string | undefined, 
    options?: {
      model?: string;
    }
  ) {
    // 添加用户消息到会话
    if (message){
      session.addUserMessage(message);
    }
    
    // 获取完整消息历史
    const messages = session.getMessages();
    
    const model = options?.model || this.options.defaultModel || '';

    return {
      messages,
      model,
      options,
    };
  }

  // 多轮对话流式接口 - 子类可以重写此方法
  public async continueSessionStream(params: {
    session: Session,
    message?: string | undefined,
    options?: {
      model?: string;
    },
    mcpTools?: Array<MCPTool>,
    signal?: AbortSignal
  }) {
    const {
      messages, model
    } = await this.prepareSessionRequest(params.session, params.message, params.options);
    
    // 使用流式API发送请求
    const streamResponse = await this.chat.completions.createStream({
      model,
      messages,
      mcpTools: params.mcpTools,
      signal: params.signal
    });
    
    // 使用tee方法创建两个独立的流
    const [streamForClient, streamForCollecting] = streamResponse.tee();
    
    // 返回包装后的流
    return {
      stream: streamForClient,
      onComplete: async(
        fullContent: string,
        fullReasoningContent: string,
        toolCalls: Array<ChatCompletionMessageToolCall> | null
      ) => {
        logger.log(this.loggerPrefix, `流式响应完成: ${JSON.stringify({
          fullContent,
          fullReasoningContent,
          toolCalls
        })}`);
      }
    };
  }

  // 聊天接口 - 抽象方法，由子类实现
  public abstract chat: {
    completions: {
      create?: (request: CompletionRequest) => Promise<CompletionResponse>;
      createStream: (params: {
        model: string;
        messages: Array<Message>;
        mcpTools?: Array<MCPTool>;
        signal?: AbortSignal;
      }) => Promise<any>;
    }
  };
} 