import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionToolMessageParam, ChatCompletionAssistantMessageParam, ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';
import { 
  MCPTool,
  Message,
  ClientOptions
} from '../types';
import { delay, generateUUID } from '../utils';
import { DEEPSEEK_DEFAULT_URL, DEEPSEEK_MODELS } from '../constants';
import MCPClient from '../mcpClient';

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
    this.messages.push({
      role: 'system',
      content
    });
  }
  
  // 添加用户消息
  public addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content
    });
  }
  
  // 添加助手消息
  public addAssistantMessage(content: string, reasoningContent?: string, toolCalls?: Array<ChatCompletionMessageToolCall>): void {
    this.messages.push({
      role: 'assistant',
      content,
      tool_calls: toolCalls,
      reasoning_content: reasoningContent
    });
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
  private mcpClient: MCPClient;

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

    // 初始化MCP客户端
    this.mcpClient = new MCPClient("deepseek-client", "1.0.0");

    console.log('[DeepSeek] 初始化客户端完成');
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
    
    console.log('[DeepSeek] 已更新客户端配置:', this.options);
  }

  // 创建新的会话
  public createSession(): string {
    const session = new Session();
    const sessionId = session.getId();
    console.log('[DeepSeek] 创建新会话:', sessionId);
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
  public async sendStreamMessageToSession(
    sessionId: string, 
    message?: string, 
    options?: {
      model?: string;
    }
  ) {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    return await this.continueSessionStream(session, message, options);
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
    userMessage?: string | undefined, 
    options?: {
      model?: string;
    }
  ) {
    // 添加用户消息到会话
    if (userMessage){
      session.addUserMessage(userMessage);
    }
    
    // 获取完整消息历史
    const messages = session.getMessages();
    
    console.log('[DeepSeek] 准备请求参数:', {
      model: options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT,
      messagesCount: messages.length,
      hasTools: this.isReasonerModel(options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT) ? false : true
    });
    const model = options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
    const isReasoner = this.isReasonerModel(model);

    // MCP工具
    const tools: Array<MCPTool> = await this.mcpClient.collectToolsFromAllServers();

    console.log('[DeepSeek] 收集到的工具:', tools);

    return {
      messages,
      model,
      isReasoner,
      options,
      tools: isReasoner ? undefined : tools // 非推理模型，添加工具
    };
  }

  // 多轮对话流式接口
  public async continueSessionStream(
    session: Session,
    userMessage?: string | undefined,
    options?: {
      model?: string;
    }
  ) {
    console.log('[DeepSeek] 准备发送流式请求');
    const {
      messages, model, isReasoner, tools 
    } = await this.prepareSessionRequest(session, userMessage, options);
    
    // 使用流式API发送请求
    const streamResponse = await this.chat.completions.createStream({
      model,
      messages,
      tools
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
        // 工具调用
        if (toolCalls && toolCalls.length > 0) {
          for(const toolCall of toolCalls) {
            // 调用工具获取结果
            const res = await this.callTool(session, toolCall);

            if (res.status) {
              // 调用成功
              // 添加工具成功到会话
              session.addToolMessage(
                res.id || '',
                res.result || '',
              );
            } else {
              // 调用失败
              // 添加工具失败到会话
              session.addToolMessage(
                res.id || '',
                JSON.stringify({errorMessage: res.errorMessage}),
              );
            }
          }
        }
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
        tools?: Array<MCPTool>,
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
            tools: params.tools?.map(tool => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
              }
            }))
          };

          console.log('[DeepSeek] 发送流式请求:', {
            model: modelName,
            messagesCount: messages.length,
            toolsCount: params.tools?.length || 0
          });
          
          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          // 验证流对象 - 更详细的日志
          console.log('[DeepSeek] 流式响应开始:', {
            timestamp: new Date().toISOString()
          });
          
          return stream;
        } catch (error) {
          console.error('DeepSeek 流式API请求失败:', error);
          throw error;
        }
      },
    }
  };

  /**
   * 调用工具请求
   */
  async callTool(
    session: Session,
    toolCall: ChatCompletionMessageToolCall
  ) {
    // 无工具
    if (!toolCall.function || !toolCall.function.name) {
      throw new Error('工具不存在');
    }

    console.log('[DeepSeek] 开始调用工具');
    console.log(toolCall);

    try {
      // 解析参数 - 修复空字符串解析问题
      let args = {};
      if (toolCall.function.arguments && toolCall.function.arguments.trim() !== '') {
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          console.error('[DeepSeek][工具] 解析参数失败:', parseError);
          // 保持 args 为空对象并继续执行
        }
      }
      
      // 从工具名中提取服务器键和实际工具名
      const [serverKey, actualToolName] = toolCall.function.name.split('_SERVERKEYTONAME_');
      const result = await this.mcpClient.callTool(
        {
          name: actualToolName || toolCall.function.name,
          arguments: args
        },
        serverKey
      );

      console.log('[DeepSeek][工具] 调用成功:', result);
      
      return {
        status: true,
        id: toolCall.id,
        result: JSON.stringify(result)
      }
    } catch (err: any) {
      // 类型安全的错误处理
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.log('[DeepSeek][工具] 调用失败:', errorMessage);

      return {
        status: false,
        id: toolCall.id,
        errorMessage: errorMessage
      }
    }
  }
}