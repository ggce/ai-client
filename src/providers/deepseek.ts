import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionToolMessageParam } from 'openai/resources/chat/completions';
import { 
  CompletionRequest, 
  CompletionResponse,
  Message,
  ClientOptions
} from '../types';
import { generateUUID, withRetry } from '../utils';
import { DEEPSEEK_DEFAULT_URL, DEEPSEEK_MODELS } from '../constants';
import MCPClient from '../mcpClient';

// 对话消息接口
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 扩展OpenAI消息接口，包含推理内容
export interface DeepseekReasonerMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning_content?: string;
}

// 会话管理类 - 用于多轮对话
export class Conversation {
  private messages: ConversationMessage[] = [];
  private reasoningContents: Map<number, string> = new Map(); // 存储每轮助手回复的推理内容
  private id: string;
  
  constructor(systemMessage?: string) {
    this.id = generateUUID();
    
    // 如果提供了系统消息，则添加到对话历史的开头
    if (systemMessage) {
      this.messages.push({
        role: 'system',
        content: systemMessage
      });
    }
  }
  
  // 获取会话ID
  public getId(): string {
    return this.id;
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
    const index = this.messages.length;
    this.messages.push({
      role: 'assistant',
      content
    });
    
    // 如果有推理内容，则存储
    if (reasoningContent) {
      this.reasoningContents.set(index, reasoningContent);
    }
  }
  
  // 获取所有消息历史(不包含推理内容，用于API调用)
  public getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
  
  // 获取特定消息的推理内容
  public getReasoningContent(messageIndex: number): string | undefined {
    return this.reasoningContents.get(messageIndex);
  }
  
  // 获取最后一条助手消息的推理内容
  public getLastReasoningContent(): string | undefined {
    const assistantIndices = this.messages
      .map((msg, idx) => msg.role === 'assistant' ? idx : -1)
      .filter(idx => idx !== -1);
    
    if (assistantIndices.length === 0) return undefined;
    
    const lastAssistantIndex = assistantIndices[assistantIndices.length - 1];
    return this.reasoningContents.get(lastAssistantIndex);
  }
  
  // 清空会话历史（但保留系统消息如果有的话）
  public clear(keepSystemMessage: boolean = true): void {
    if (keepSystemMessage && this.messages.length > 0 && this.messages[0].role === 'system') {
      const systemMessage = this.messages[0];
      this.messages = [systemMessage];
    } else {
      this.messages = [];
    }
    this.reasoningContents.clear();
  }
}

// 使用OpenAI SDK连接DeepSeek API的客户端实现
export class DeepseekClient {
  private client: OpenAI;
  private options: ClientOptions;
  private conversations: Map<string, Conversation> = new Map();
  private mcpClient: MCPClient;

  constructor(config?: ClientOptions) {
    this.options = {
      apiKey: config?.apiKey || '',
      baseUrl: config?.baseUrl || DEEPSEEK_DEFAULT_URL,
      defaultModel: config?.defaultModel || DEEPSEEK_MODELS.DEFAULT,
      timeout: config?.timeout || 30000,
      maxRetries: config?.maxRetries || 3
    };

    // 创建OpenAI客户端实例，连接到DeepSeek API
    this.client = new OpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries
    });

    // 初始化MCP客户端
    this.mcpClient = new MCPClient("deepseek-client", "1.0.0");

    console.log('初始化DeepSeek客户端，使用OpenAI SDK连接');
  }

  // 创建新的会话
  public createConversation(systemMessage?: string): Conversation {
    const conversation = new Conversation(systemMessage);
    this.conversations.set(conversation.getId(), conversation);
    return conversation;
  }
  
  // 获取会话
  public getConversation(id: string): Conversation | undefined {
    return this.conversations.get(id);
  }
  
  // 删除会话
  public deleteConversation(id: string): boolean {
    return this.conversations.delete(id);
  }

  // 检查模型是否为推理模型
  private isReasonerModel(model: string): boolean {
    return model === 'deepseek-reasoner';
  }

  // 准备会话请求共享逻辑
  private async prepareConversationRequest(
    conversation: Conversation, 
    userMessage: string, 
    options?: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
    }
  ) {
    // 添加用户消息到会话
    conversation.addUserMessage(userMessage);
    
    // 获取完整消息历史
    const messages = conversation.getMessages();
    
    const model = options?.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
    const isReasoner = this.isReasonerModel(model);

    // 工具
    const tools = await this.mcpClient.collectToolsFromAllServers();
    
    return { messages, model, isReasoner, options, tools };
  }

  // 多轮对话接口 - 传入会话对象和用户消息，返回助手响应
  public async continueConversation(
    conversation: Conversation,
    userMessage: string,
    options?: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<{ content: string; reasoningContent?: string }> {
    const { messages, model, isReasoner, options: requestOptions, tools } = 
      await this.prepareConversationRequest(conversation, userMessage, options);
    
    // 发送请求
    const response = await this.chat.completions.create({
      model,
      messages,
      max_tokens: requestOptions?.max_tokens,
      temperature: requestOptions?.temperature,
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
      
      // 将助手响应添加到会话历史
      conversation.addAssistantMessage(assistantMessage, reasoningContent);
      
      return { content: assistantMessage, reasoningContent };
    } else {
      throw new Error('收到了意外的流式响应');
    }
  }
  
  // 多轮对话流式接口
  public async continueConversationStream(
    conversation: Conversation,
    userMessage: string,
    options?: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
    }
  ) {
    const { messages, model, isReasoner, options: requestOptions, tools } = 
      await this.prepareConversationRequest(conversation, userMessage, options);
    
    // 使用流式API发送请求
    const stream = await this.chat.completions.createStream({
      model,
      messages,
      max_tokens: requestOptions?.max_tokens,
      temperature: requestOptions?.temperature
    });
    
    // 收集完整的响应以添加到会话历史
    let fullResponse = '';
    let fullReasoningContent = '';
    
    // 返回包装后的流，自动收集完整响应并在最后添加到会话历史
    return {
      stream,
      onComplete: (completeCallback?: (response: { content: string; reasoningContent?: string }) => void) => {
        // 创建一个异步函数来处理流
        const handleStream = async () => {
          try {
            const startTime = Date.now();
            let chunkCount = 0;
            
            for await (const chunk of stream) {
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
            conversation.addAssistantMessage(fullResponse, isReasoner ? fullReasoningContent : undefined);
            
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
        stream?: boolean;
        max_tokens?: number;
        temperature?: number;
      }) => {
        // 确保消息格式正确（role必须是'user'|'assistant'|'system'）
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })) as ChatCompletionMessageParam[];

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
          
          // 收集工具
          const tools = await this.mcpClient.collectToolsFromAllServers();
          
          // 准备正确类型的API请求参数
          const requestParams = {
            model: modelName,
            messages,
            // 确保stream为false (非流式)
            stream: false,
            max_tokens: params.max_tokens,
            temperature: params.temperature,
            // 确保工具类型正确
            tools: tools.length > 0 ? tools.map(tool => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
              }
            })) : undefined
          };

          // 记录请求信息
          console.log(`DeepSeek 请求`, requestParams);

          // 发送请求
          const response = await this.client.chat.completions.create(requestParams);
          
          // 记录响应信息
          if ('choices' in response) {
            console.log(`DeepSeek 响应`, response);
          }
          
          if ('choices' in response && 
              response.choices[0]?.finish_reason === 'tool_calls' && 
              response.choices[0]?.message?.tool_calls && 
              response.choices[0].message.tool_calls.length > 0) {
            
            // 安全地获取消息和工具调用
            const message = response.choices[0].message;
            const toolCalls = message.tool_calls;
            
            console.log('DeepSeek 请求工具调用:', {
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
          console.error('DeepSeek API 请求失败:', error);
          throw error;
        }
      },

      // 流式API
      createStream: async (params: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
        temperature?: number;
      }) => {
        // 确保消息格式正确
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        })) as ChatCompletionMessageParam[];

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
          
          // 收集工具
          const tools = await this.mcpClient.collectToolsFromAllServers();
          
          // 准备正确类型的API请求参数
          const requestParams = {
            model: modelName,
            messages,
            // 确保stream为true (流式)
            stream: true as const,
            max_tokens: params.max_tokens || 2048,
            temperature: params.temperature || 0.7,
            // 确保工具类型正确
            tools: tools.length > 0 ? tools.map(tool => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters
              }
            })) : undefined
          };

          // 记录请求信息
          console.log(`DeepSeek 流式请求`, requestParams);
          
          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          // 验证流对象
          console.log('DeepSeek 流式响应开始:', stream);
          
          return stream;
        } catch (error) {
          console.error('DeepSeek 流式API请求失败:', error);
          throw error;
        }
      }
    }
  };

  // 简化的文本补全API
  public async complete(prompt: string | Message[]): Promise<string> {
    let messages: Message[];
    
    if (typeof prompt === 'string') {
      messages = [{ role: 'user', content: prompt }];
    } else {
      messages = prompt;
    }

    try {
      // 确保model不会为undefined
      const modelName = this.options.defaultModel || DEEPSEEK_MODELS.DEFAULT;
      
      console.log(`DeepSeek 简单补全请求:`, {
        model: modelName,
        message_count: messages.length,
        last_message_preview: messages[messages.length-1]?.content?.substring(0, 100)
      });
      
      const response = await this.chat.completions.create({
        model: modelName,
        messages,
      });

      // 确保我们得到的是非流式响应
      if ('choices' in response) {
        const content = response.choices[0]?.message?.content || '';
        
        // 记录响应信息
        console.log(`DeepSeek 简单补全响应:`, {
          content_length: content.length,
          content_preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          finish_reason: response.choices[0]?.finish_reason,
          usage: response.usage
        });
        
        return content;
      } else {
        throw new Error('收到了意外的流式响应');
      }
    } catch (error: any) {
      console.error('DeepSeek完成请求错误:', error.message);
      throw error;
    }
  }

  // 嵌入API
  public async createEmbedding(input: string | string[]) {
    const payload = {
      model: 'text-embedding-ada-002', // 使用有效的模型名称
      input: Array.isArray(input) ? input : [input],
    };

    try {
      const response = await this.client.embeddings.create(payload);
      return response.data;
    } catch (error: any) {
      console.error('DeepSeek嵌入请求错误:', error.message);
      throw error;
    }
  }
} 