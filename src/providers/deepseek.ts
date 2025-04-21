import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions';
import { 
  MCPTool,
  Message,
  ClientOptions
} from '../types';
import { generateUUID } from '../utils';
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
  public addAssistantMessage(content: string, reasoningContent?: string): void {
    this.messages.push({
      role: 'assistant',
      content,
      reasoning_content: reasoningContent
    });
  }
  
  // 添加工具消息
  public addToolMessage(content: string, toolCallId: string): void {
    this.messages.push({
      role: 'tool',
      content,
      tool_call_id: toolCallId
    });
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

// 使用OpenAI SDK连接DeepSeek API的客户端实现
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

    console.log('初始化DeepSeek客户端，使用OpenAI SDK连接');
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
    
    console.log('已更新DeepSeek客户端配置', this.options || "????");
  }

  // 创建新的会话
  public createSession(): string {
    const session = new Session();
    const sessionId = session.getId();
    console.log('创建新会话:', sessionId);
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
   * 向会话发送消息并获取回复
   * @param sessionId 会话ID
   * @param message 用户消息
   * @param options 可选配置项
   * @returns 助手回复和推理内容
   */
  public async sendMessageToSession(
    sessionId: string, 
    message: string, 
    options?: {
      model?: string;
    }
  ): Promise<{ content: string; reasoningContent?: string }> {
    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }
    
    return await this.continueSession(session, message, options);
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
    message: string, 
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

  /**
   * 结束并删除会话
   * @param sessionId 会话ID
   * @returns 删除是否成功
   */
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
    userMessage: string, 
    options?: {
      model?: string;
    }
  ) {
    // 添加用户消息到会话
    session.addUserMessage(userMessage);
    
    // 获取完整消息历史
    const messages = session.getMessages();
    
    console.log('打印model'!!!!);
    console.log(options?.model || "????");
    const model = options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
    const isReasoner = this.isReasonerModel(model);

    // MCP工具
    const tools: Array<MCPTool> = await this.mcpClient.collectToolsFromAllServers();

    return {
      messages,
      model,
      isReasoner,
      options,
      tools: isReasoner ? undefined : tools // 非推理模型，添加工具
    };
  }

  // 多轮对话接口 - 传入会话对象和用户消息，返回助手响应
  public async continueSession(
    session: Session,
    userMessage: string,
    options?: {
      model?: string;
    }
  ): Promise<{ content: string; reasoningContent?: string }> {
    const {
      messages, model, isReasoner, tools
    } = await this.prepareSessionRequest(session, userMessage, options);
    
    // 发送请求
    const response = await this.chat.completions.create({
      model,
      messages,
      tools,
    });
    
    // 确保我们得到的是非流式响应
    if ('choices' in response) {
      // 获取助手响应
      const assistantMessage = response.choices[0]?.message?.content || '';
      
      // 如果是推理模型，获取推理内容
      let reasoningContent: string | undefined;
      if (isReasoner && response.choices[0]?.message) {
        // @ts-ignore - 添加推理内容访问支持
        reasoningContent = response.choices[0].message.reasoning_content;
      }
      
      // 检查是否有工具调用
      if (response.choices[0]?.message?.tool_calls && 
          response.choices[0].message.tool_calls.length > 0) {
        
        // 将助手响应添加到会话历史（包含工具调用）
        session.addAssistantMessage(assistantMessage, reasoningContent);
        
        // 处理工具调用
        const toolCalls = response.choices[0].message.tool_calls;
        
        // 执行工具调用并收集结果
        for (const toolCall of toolCalls) {
          try {
            // 解析参数
            const args = JSON.parse(toolCall.function.arguments || '{}');
            
            // 从工具名中提取服务器键和实际工具名
            const [serverKey, actualToolName] = toolCall.function.name.split('_SERVERKEYTONAME_');
            const result = await this.mcpClient.callTool(
              {
                name: actualToolName || toolCall.function.name,
                arguments: args
              },
              serverKey
            );
            
            // 添加工具响应到会话
            session.addToolMessage(
              JSON.stringify(result),
              toolCall.id
            );
          } catch (error) {
            // 处理错误
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`执行工具 ${toolCall.function.name} 失败:`, errorMessage);
            
            // 添加错误响应到会话
            session.addToolMessage(
              JSON.stringify({ error: errorMessage }),
              toolCall.id
            );
          }
        }
        
        // 再次发送请求，包含工具响应
        const finalResponse = await this.chat.completions.create({
          model,
          messages: session.getMessages(),
        });
        
        if ('choices' in finalResponse) {
          const finalAssistantMessage = finalResponse.choices[0]?.message?.content || '';
          
          // 如果是推理模型，获取推理内容
          let finalReasoningContent: string | undefined;
          if (isReasoner && finalResponse.choices[0]?.message) {
            // @ts-ignore - 添加推理内容访问支持
            finalReasoningContent = finalResponse.choices[0].message.reasoning_content;
          }
          
          // 将最终助手响应添加到会话历史
          session.addAssistantMessage(finalAssistantMessage, finalReasoningContent);
          
          return { content: finalAssistantMessage, reasoningContent: finalReasoningContent };
        }
      } else {
        // 没有工具调用，直接添加助手响应到会话历史
        session.addAssistantMessage(assistantMessage, reasoningContent);
        
        return { content: assistantMessage, reasoningContent };
      }
      
      return { content: assistantMessage, reasoningContent };
    } else {
      throw new Error('收到了意外的流式响应');
    }
  }
  
  // 多轮对话流式接口
  public async continueSessionStream(
    session: Session,
    userMessage: string,
    options?: {
      model?: string;
    }
  ) {
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
    
    // 收集完整的响应以添加到会话历史
    let fullResponse = '';
    let fullReasoningContent = '';
    
    // 返回包装后的流，自动收集完整响应并在最后添加到会话历史
    return {
      stream: streamForClient,
      onComplete: (completeCallback?: (response: { content: string; reasoningContent?: string }) => void) => {
        // 创建一个异步函数来处理流
        const handleStream = async () => {
          try {
            const startTime = Date.now();
            let chunkCount = 0;
            
            // 使用独立的流副本进行处理
            for await (const chunk of streamForCollecting) {
              chunkCount++;
              const content = chunk.choices[0]?.delta?.content || '';
              fullResponse += content;
              
              // 如果是推理模型，收集推理内容
              if (isReasoner) {
                // @ts-ignore - 添加推理内容访问支持
                const reasoningContent = chunk.choices[0]?.delta?.reasoning_content || '';
                fullReasoningContent += reasoningContent;
              }
            }
            
            const duration = Date.now() - startTime;
            
            // 流结束后记录完整响应信息
            console.log(`DeepSeek 流式响应完成 (${model})`, {
              total_chunks: chunkCount,
              duration_ms: duration,
              content_length: fullResponse.length,
              content_preview: fullResponse.substring(0, 100) + (fullResponse.length > 100 ? '...' : ''),
              has_reasoning: isReasoner && fullReasoningContent.length > 0,
              reasoning_length: fullReasoningContent.length
            });
            
            // 流结束后，将完整响应添加到会话历史
            session.addAssistantMessage(fullResponse, isReasoner ? fullReasoningContent : undefined);
            
            // 如果提供了回调，则调用它
            if (completeCallback) {
              completeCallback({
                content: fullResponse,
                reasoningContent: isReasoner ? fullReasoningContent : undefined
              });
            }
          } catch (error) {
            console.error('处理流数据时出错:', error);
          }
        };
        
        // 启动处理，但不等待它完成
        handleStream();
      }
    };
  }

  // 聊天接口
  public chat = {
    completions: {
      // 非流式API
      create: async (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        tools?: Array<MCPTool>;
      }) => {
        // 确保消息格式正确（role必须是'user'|'assistant'|'system'）
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })) as ChatCompletionMessageParam[];

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
          
          // 准备正确类型的API请求参数
          const requestParams = {
            model: modelName,
            messages,
            // 确保stream为false (非流式)
            stream: false,
            max_tokens: 2048,
            temperature: 0.7,
            // 确保工具类型正确
            tools: params.tools?.map(tool => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
              }
            }))
          };

          // 记录请求信息
          console.log(`DeepSeek[非流式]请求:`, requestParams);

          // 发送请求
          const response = await this.client.chat.completions.create(requestParams);
          
          // 记录响应信息 - 更详细的响应摘要
          if ('choices' in response) {
            const content = response.choices[0]?.message?.content || '';
            console.log(`DeepSeek[非流式]响应信息:`, {
              choices_count: response.choices.length,
              content_length: content.length,
              content_preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
              finish_reason: response.choices[0]?.finish_reason,
              usage: response.usage
            });
          }
          
          if ('choices' in response && 
              response.choices[0]?.finish_reason === 'tool_calls' && 
              response.choices[0]?.message?.tool_calls && 
              response.choices[0].message.tool_calls.length > 0) {
            
            // 安全地获取消息和工具调用
            const message = response.choices[0].message;
            const toolCalls = message.tool_calls;
            
            console.log('DeepSeek[非流式]请求工具调用:', {
              tool_calls_count: toolCalls?.length,
              first_tool: toolCalls && toolCalls[0]?.function?.name
            });
            
            // 执行工具调用并收集结果 - 确保正确的类型
            const toolResults: ChatCompletionToolMessageParam[] = [];
            
            for (const toolCall of toolCalls || []) {
              try {
                // 解析参数
                const args = JSON.parse(toolCall.function.arguments || '{}');
                
                // 从工具名中提取服务器键和实际工具名
                const [serverKey, actualToolName] = toolCall.function.name.split('_SERVERKEYTONAME_');
                const result = await this.mcpClient.callTool(
                  {
                    name: actualToolName || toolCall.function.name,
                    arguments: args
                  },
                  serverKey
                );
                
                // 添加到结果列表 - 移除name属性，确保符合OpenAI规范
                toolResults.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify(result)
                });
              } catch (err: any) {
                // 类型安全的错误处理
                const errorMessage = err instanceof Error ? err.message : String(err);
                console.error(`执行工具 ${toolCall.function.name} 失败:`, errorMessage);
                
                toolResults.push({
                  role: 'tool',
                  tool_call_id: toolCall.id,
                  content: JSON.stringify({ error: errorMessage })
                });
              }
            }
            
            // 创建类型安全的消息数组
            const updatedMessages = [
              ...messages,
              message,
              ...toolResults
            ];
            
            // 发送后续请求获取最终结果
            const finalResponse = await this.client.chat.completions.create({
              model: modelName,
              messages: updatedMessages,
              tools: requestParams.tools
            });
            
            return finalResponse;
          }
          
          return response;
        } catch (error) {
          console.error('DeepSeek[非流式]API 请求失败:', error);
          throw error;
        }
      },

      // 流式API
      createStream: async (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        tools?: Array<MCPTool>,
      }) => {
        // 确保消息格式正确
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
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

          console.log(this.client);
          // 记录请求信息 - 使用截断的参数
          console.log(`DeepSeek[流式]请求:`, requestParams);
          
          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          // 验证流对象 - 更详细的日志
          console.log('DeepSeek[流式]响应开始:', {
            stream_type: typeof stream,
            isAsyncIterable: typeof stream[Symbol.asyncIterator] === 'function',
            timestamp: new Date().toISOString()
          });
          
          return stream;
        } catch (error) {
          console.error('DeepSeek 流式API请求失败:', error);
          throw error;
        }
      }
    }
  };
}