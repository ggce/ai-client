import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import { 
  Message,
  ClientOptions,
  MCPTool
} from '../types';
import { delay, generateUUID } from '../utils';
import { DEEPSEEK_DEFAULT_URL, DEEPSEEK_MODELS } from '../constants';
import logger from '../logger';

// 会话管理类 - 用于开启多个会话
export class Session {
  private id: string;
  private messages: Message[] = [];
  
  constructor() {
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

    logger.log('DeepseekClient', '添加 [system] message');
    logger.log('DeepseekClient', message);
  }
  
  // 添加用户消息
  public addUserMessage(content: string): void {
    const message: Message = {
      role: 'user',
      content
    }

    this.messages.push(message);

    logger.log('DeepseekClient', '添加 [user] message');
    logger.log('DeepseekClient', message);
  }
  
  // 添加助手消息
  public addAssistantMessage(content: string, reasoningContent?: string, toolCalls?: Array<ChatCompletionMessageToolCall>): void {
    const message: Message = {
      role: 'assistant',
      content,
      tool_calls: toolCalls,
      reasoning_content: reasoningContent
    }

    this.messages.push(message);

    logger.log('DeepseekClient', '添加 [assistant] message');
    logger.log('DeepseekClient', message);
  }
  
  // 添加工具消息
  public addToolMessage(toolCallId: string, content: string): void {
    const message: Message = {
      role: 'tool',
      content,
      tool_call_id: toolCallId,
      timestamp: Date.now()
    };
    this.messages.push(message);


    logger.log('DeepseekClient', '添加 [tool] message');
    logger.log('DeepseekClient', message);
  }

  // 获取会话ID
  public getId(): string {
    return this.id;
  }
  
  // 获取所有消息
  public getMessages(): Message[] {
    return this.messages;
  }
}

/**
 * 使用OpenAI SDK连接DeepSeek API的客户端实现
 * 此客户端仅支持流式API，提供更高效的对话体验
 */
export class DeepseekClient {
  private client: OpenAI;
  private options: ClientOptions;
  private sessions: Map<string, Session> = new Map();

  constructor(config?: ClientOptions) {
    this.options = {
      apiKey: config?.apiKey || '',
      baseURL: config?.baseURL || DEEPSEEK_DEFAULT_URL,
      defaultModel: config?.defaultModel || DEEPSEEK_MODELS.DEFAULT,
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3
    };

    // 创建OpenAI客户端实例，连接到DeepSeek API
    this.client = new OpenAI(this.options);

    logger.log('DeepseekClient', '初始化客户端完成');
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
    this.client = new OpenAI(this.options);
    
    logger.log('DeepseekClient', `已更新客户端配置: ${JSON.stringify(this.options)}`);
  }

  // 创建新的会话
  public createSession(): string {
    const session = new Session();
    const sessionId = session.getId();
    logger.log('DeepseekClient', `创建新会话: ${sessionId}`);
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

  // 列出所有会话ID
  public listSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * 获取特定会话的全部消息
   * @param sessionId 会话ID
   * @returns 会话中的消息历史，包含推理内容
   */
  public getSessionMessages(sessionId: string): Array<Message> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    // 直接使用包含推理内容的消息历史
    return session.getMessages();
  }

  /**
   * 向会话发送流式消息并获取流式回复
   * @param sessionId 会话ID
   * @param message 用户消息
   * @param options 可选配置项
   * @returns 流式结果对象
   */
  public async sendStreamMessageToSession(params: {
    sessionId: string, 
    message?: string, 
    options?: {
      model?: string;
    },
    mcpTools?: Array<MCPTool>
  }) {
    const session = this.getSession(params.sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    return await this.continueSessionStream({
      session,
      message: params.message,
      options: params.options,
      mcpTools: params.mcpTools
    });
  }

  // 结束并删除会话
  public endSession(sessionId: string): boolean {
    return this.deleteSession(sessionId);
  }

  // 检查模型是否为推理模型
  private isReasonerModel(model: string): boolean {
    return model === 'deepseek-reasoner';
  }

  // 准备会话请求共享逻辑
  private async prepareSessionRequest(
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
    
    const model = options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
    const isReasoner = this.isReasonerModel(model);

    return {
      messages,
      model,
      isReasoner,
      options,
    };
  }

  // 多轮对话流式接口
  public async continueSessionStream(params: {
    session: Session,
    message?: string | undefined,
    options?: {
      model?: string;
    },
    mcpTools?: Array<MCPTool>
  }) {
    const {
      messages, model, isReasoner 
    } = await this.prepareSessionRequest(params.session, params.message, params.options);
    
    // 使用流式API发送请求
    const streamResponse = await this.chat.completions.createStream({
      model,
      messages,
      mcpTools: params.mcpTools
    });
    
    // 使用tee方法创建两个独立的流，一个用于返回，一个用于收集完整响应
    const [streamForClient, streamForCollecting] = streamResponse.tee();
    
    // 返回包装后的流，自动收集完整响应并在最后添加到会话历史
    return {
      stream: streamForClient,
      onComplete: async(
        fullContent: string,
        fullReasoningContent: string,
        toolCalls: Array<ChatCompletionMessageToolCall> | null
      ) => {
        logger.log('DeepseekClient', `流式响应完成: ${JSON.stringify({
          fullContent,
          fullReasoningContent,
          toolCalls
        })}`);
      }
    };
  }

  // 聊天接口
  public chat = {
    completions: {
      // 流式API
      createStream: async (params: {
        model: string;
        messages: Array<{ role: string; content: string, tool_call_id?: string, tool_calls?: Array<ChatCompletionMessageToolCall> }>;
        mcpTools?: Array<MCPTool>,
      }) => {
        // 确保消息格式正确
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          tool_call_id: msg.tool_call_id,
          tool_calls: msg.tool_calls,
        })) as ChatCompletionMessageParam[];

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
          
          // 准备正确类型的API请求参数
          const requestParams = {
            model: modelName,
            messages,
            // 确保stream为true (流式)
            stream: true as const,
            max_tokens: 2048,
            temperature: 0.7,
            // 工具类型正确 - 流式响应也支持工具
            tools: params.mcpTools?.map(tool => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
              }
            }))
          };

          // 验证流对象 - 更详细的日志
          logger.log('DeepseekClient', `流式响应开始: ${JSON.stringify(requestParams)}`);

          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          return stream;
        } catch (error) {
          console.error('[DeepseekClient] => 流式API请求失败:', error);
          throw error;
        }
      },
    }
  };
}