import OpenAI from 'openai';
import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import { 
  ClientOptions,
  Message,
  MCPTool,
  CompletionRequest,
  CompletionResponse,
  TokenLimitExceededHandler,
  TokenLimitExceededEvent
} from '../types';
import { generateUUID } from '../utils';
import logger from '../logger';
import { createHistorySummarizer, HistorySummarizer } from '../historySummarizer';
import { FileLoader } from '../utils/fileLoader';

// 会话管理类 - 通用实现
export class Session {
  private id: string;
  private messages: Message[] = [];
  
  constructor(private loggerPrefix: string = 'BaseClient') {
    this.id = generateUUID();
  }
  
  // 添加系统消息
  public addSystemMessage(content: string, isShow: boolean = true): void {
    const message: Message = {
      role: 'system',
      content,
      isShow
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
  public addAssistantMessage(content: string, reasoningContent?: string, toolCalls?: Array<ChatCompletionMessageToolCall>): void {
    const message: Message = {
      role: 'assistant',
      content,
      toolCalls,
      reasoningContent
    }

    this.messages.push(message);

    logger.log(this.loggerPrefix, '添加 [assistant] message');
    logger.log(this.loggerPrefix, message);
  }
  
  // 添加工具消息
  public addToolMessage(toolCallId: string, content: string): void {
    const message: Message = {
      role: 'tool',
      content,
      toolCallId,
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
  
  // 设置消息数组（用于更新消息，如在压缩之后）
  public setMessages(messages: Message[]): void {
    this.messages = [...messages];
    logger.log(this.loggerPrefix, `会话消息已更新，当前消息数: ${this.messages.length}`);
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
  protected historySummarizer: HistorySummarizer | null = null;
  protected lunaSystemPrompt: string;
  
  // token限制相关设置
  protected tokenLimit: number = 58 * 1024;  // 默认token限制
  protected onTokenLimitExceeded: TokenLimitExceededHandler | null = null;  // token超限处理函数

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
    
    // 如果提供了apiKey，初始化历史摘要器
    if (this.options.apiKey) {
      this.initHistorySummarizer(this.options.apiKey, this.options.baseURL);
    }

    // 加载Luna的系统提示
    try {
      this.lunaSystemPrompt = FileLoader.loadFile('prompts/luna.md');
      logger.log(this.loggerPrefix, '成功加载Luna系统提示');
    } catch (error) {
      logger.error(this.loggerPrefix, `加载Luna系统提示失败: ${error}`);
      this.lunaSystemPrompt = '';
    }
    
    logger.log(this.loggerPrefix, '初始化客户端完成');
  }

  /**
   * 设置token超限处理函数
   * @param handler 处理函数，接收事件并返回是否创建新会话的布尔值
   */
  public setTokenLimitHandler(handler: TokenLimitExceededHandler): void {
    this.onTokenLimitExceeded = handler;
    logger.log(this.loggerPrefix, `已配置token超限处理函数`);
  }

  /**
   * 处理API返回的token超限错误
   * @param sessionId 会话ID
   * @param error OpenAI API错误对象
   */
  protected async handleTokenLimitError(sessionId: string, error: any): Promise<void> {
    // 添加详细的错误日志
    logger.log(this.loggerPrefix, '收到错误对象，结构如下：');
    logger.log(this.loggerPrefix, `error instanceof Error: ${error instanceof Error}`);
    logger.log(this.loggerPrefix, `error.message: ${error.message}`);
    logger.log(this.loggerPrefix, 'error对象完整内容:');
    logger.log(this.loggerPrefix, JSON.stringify(error, null, 2));
    
    // 检查是否是token超限错误
    const isTokenLimitError = 
      // 检查状态码是否为400
      error.status === 400 &&
      error.message && (
        // 检查错误消息是否包含token超限相关的关键词
        error.message.includes('maximum context length') ||
        error.message.includes('requested') && error.message.includes('tokens') ||
        error.message.includes('reduce the length')
      );

    if (isTokenLimitError) {
      logger.warn(this.loggerPrefix, `会话token数超限: ${error.message}`);
      
      const session = this.getSession(sessionId);
      if (!session) {
        throw new Error('会话不存在');
      }

      const messages = session.getMessages();
      
      // 生成摘要用于返回给前端
      let summary = '';
      try {
        if (this.historySummarizer) {
          // 生成包含工具调用的摘要
          summary = await this.historySummarizer.summarizeHistory(messages, 4096, 0.2);
        }
      } catch (err) {
        logger.error(this.loggerPrefix, `生成会话摘要时出错: ${err}`);
        summary = '无法生成会话摘要';
      }

      // 调用token超限处理函数
      if (this.onTokenLimitExceeded) {
        try {
          // 创建事件对象
          const event: TokenLimitExceededEvent = {
            sessionId,
            summary,
            messageCount: messages.length,
          };
          // 调用处理函数
          await this.onTokenLimitExceeded(event);
        } catch (err) {
          logger.error(this.loggerPrefix, `处理token超限事件时出错: ${err}`);
        }
      }

      // 抛出特定的token超限错误
      const tokenLimitError: Error & { tokenLimitExceeded?: any } = new Error('Token限制已超出');
      tokenLimitError.tokenLimitExceeded = {
        type: 'token_limit_exceeded',
        message: error.message,
        summary: summary || '',
      };
      throw tokenLimitError;
    }
    
    // 如果不是token超限错误，继续抛出原始错误
    throw error;
  }

  // 初始化或更新历史摘要器
  protected initHistorySummarizer(
    apiKey: string, 
    baseURL?: string
  ): void {
    try {
      this.historySummarizer = createHistorySummarizer(
        apiKey,
        this.options.defaultModel || 'gpt-3.5-turbo', // 使用当前客户端的默认模型，如果未设置则使用gpt-3.5-turbo作为后备
        baseURL
      );
      logger.log(this.loggerPrefix, `历史摘要器初始化成功，使用模型: ${this.options.defaultModel || 'gpt-3.5-turbo'}`);
    } catch (error) {
      logger.error(this.loggerPrefix, `历史摘要器初始化失败: ${error}`);
      this.historySummarizer = null;
    }
  }

  // 更新options
  public updateOptions(options: Partial<ClientOptions>) {
    const previousModel = this.options.defaultModel;
    
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
    
    // 如果提供了新的apiKey，更新历史摘要器
    if (options.apiKey) {
      this.initHistorySummarizer(options.apiKey, options.baseURL || this.options.baseURL);
    }
    // 如果只是更新了默认模型，则更新现有摘要器的模型
    else if (options.defaultModel && this.historySummarizer && options.defaultModel !== previousModel) {
      this.historySummarizer.updateModel(options.defaultModel);
      logger.log(this.loggerPrefix, `已更新历史摘要器模型为: ${options.defaultModel}`);
    }
    
    logger.log(this.loggerPrefix, `已更新客户端配置: ${JSON.stringify(this.options)}`);
  }

  // 创建新的会话
  public createSession(summary?: string): string {
    const session = new Session(this.loggerPrefix);

    const sessionId = session.getId();
    logger.log(this.loggerPrefix, `创建新会话: ${sessionId}`);

    if (this.lunaSystemPrompt) {
      // 添加luna的系统消息
      session.addSystemMessage(this.lunaSystemPrompt, false);
    }

    // 继续前一对话
    if (summary) {
      session.addSystemMessage(summary);
      logger.log(this.loggerPrefix, `前会话摘要: ${summary}`);
    }

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
   * 自动处理历史消息压缩
   */
  public async sendStreamMessageToSession(params: {
    sessionId: string, 
    message?: string, 
    options?: {
      model?: string;
    },
    mcpTools?: Array<MCPTool>,
    signal?: AbortSignal,
  }) {
    const session = this.getSession(params.sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    // 发送请求并返回流
    return await this.continueSessionStream({
      session,
      message: params.message,
      options: params.options,
      mcpTools: params.mcpTools,
      signal: params.signal,
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
    signal?: AbortSignal,
  }) {
    const { messages, model } = await this.prepareSessionRequest(params.session, params.message, params.options);

    try {
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
    } catch (error) {
      // 检查是否是中止错误
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort'))) {
        logger.log(this.loggerPrefix, `流式请求被用户中止: ${error.message}`);
        // 重新抛出AbortError以确保正确处理
        throw new DOMException('请求已被用户中止', 'AbortError');
      }
      
      // 处理token超限错误
      await this.handleTokenLimitError(params.session.getId(), error);
      throw error;
    }
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