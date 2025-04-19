import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { 
  CompletionRequest, 
  CompletionResponse,
  Message
} from '../types';
import { generateUUID, withRetry } from '../utils';

// DeepSeek客户端配置接口
export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}

// 对话消息接口
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 会话管理类 - 用于多轮对话
export class Conversation {
  private messages: ConversationMessage[] = [];
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
  public addAssistantMessage(content: string): void {
    this.messages.push({
      role: 'assistant',
      content
    });
  }
  
  // 获取所有消息历史
  public getMessages(): ConversationMessage[] {
    return [...this.messages];
  }
  
  // 清空会话历史（但保留系统消息如果有的话）
  public clear(keepSystemMessage: boolean = true): void {
    if (keepSystemMessage && this.messages.length > 0 && this.messages[0].role === 'system') {
      const systemMessage = this.messages[0];
      this.messages = [systemMessage];
    } else {
      this.messages = [];
    }
  }
}

// 使用OpenAI SDK连接DeepSeek API的客户端实现
export class DeepseekClient {
  private client: OpenAI;
  private options: ClientOptions;
  private conversations: Map<string, Conversation> = new Map();

  constructor(config?: ClientOptions) {
    this.options = {
      apiKey: config?.apiKey || process.env.DEEPSEEK_API_KEY || '',
      baseUrl: config?.baseUrl || 'https://api.deepseek.com',
      defaultModel: config?.defaultModel || 'deepseek-chat',
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

  // 多轮对话接口 - 传入会话对象和用户消息，返回助手响应
  public async continueConversation(
    conversation: Conversation,
    userMessage: string,
    options?: {
      model?: string;
      max_tokens?: number;
      temperature?: number;
    }
  ): Promise<string> {
    // 添加用户消息到会话
    conversation.addUserMessage(userMessage);
    
    // 获取完整消息历史
    const messages = conversation.getMessages();
    
    // 发送请求
    const response = await this.chat.completions.create({
      model: options?.model || this.options.defaultModel || 'deepseek-chat',
      messages,
      max_tokens: options?.max_tokens,
      temperature: options?.temperature
    });
    
    // 获取助手响应
    const assistantMessage = response.choices[0]?.message?.content || '';
    
    // 将助手响应添加到会话历史
    conversation.addAssistantMessage(assistantMessage);
    
    return assistantMessage;
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
    // 添加用户消息到会话
    conversation.addUserMessage(userMessage);
    
    // 获取完整消息历史
    const messages = conversation.getMessages();
    
    // 使用流式API发送请求
    const stream = await this.chat.completions.createStream({
      model: options?.model || this.options.defaultModel || 'deepseek-chat',
      messages,
      max_tokens: options?.max_tokens,
      temperature: options?.temperature
    });
    
    // 收集完整的响应以添加到会话历史
    let fullResponse = '';
    
    // 返回包装后的流，自动收集完整响应并在最后添加到会话历史
    return {
      stream,
      onComplete: (completeCallback?: (fullText: string) => void) => {
        // 创建一个异步函数来处理流
        const handleStream = async () => {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || '';
              fullResponse += content;
            }
            
            // 流结束后，将完整响应添加到会话历史
            conversation.addAssistantMessage(fullResponse);
            
            // 如果提供了回调，则调用它
            if (completeCallback) {
              completeCallback(fullResponse);
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

        console.log(`DeepSeek 请求 (${params.model})`, {
          messages: messages.map(m => ({ 
            role: m.role, 
            // 安全处理content字段
            content: typeof m.content === 'string' 
              ? (m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content)
              : '[非文本内容]'
          })),
          stream: params.stream
        });

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || 'deepseek-chat';
          
          // 直接使用OpenAI SDK进行请求
          const response = await this.client.chat.completions.create({
            model: modelName,
            messages,
            stream: false,
            max_tokens: params.max_tokens,
            temperature: params.temperature
          });
          
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

        console.log(`DeepSeek 流式请求 (${params.model})`, {
          messages: messages.map(m => ({ 
            role: m.role, 
            // 安全处理content字段
            content: typeof m.content === 'string' 
              ? (m.content.length > 100 ? m.content.substring(0, 100) + '...' : m.content)
              : '[非文本内容]'
          }))
        });

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || 'deepseek-chat';
          
          console.log('DeepSeek 流式API请求参数:', {
            model: modelName,
            stream: true,
            max_tokens: params.max_tokens || 2048,
            temperature: params.temperature || 0.7
          });
          
          // 显式指定stream为true，确保启用流式输出
          const stream = await this.client.chat.completions.create({
            model: modelName,
            messages,
            stream: true, // 确保这个参数正确设置
            max_tokens: params.max_tokens || 2048,
            temperature: params.temperature || 0.7
          });
          
          // 增加额外日志和验证
          console.log('验证流对象基本属性:', {
            hasIterator: Symbol.asyncIterator in stream,
            type: typeof stream,
            isObject: stream instanceof Object
          });
          
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
      const modelName = this.options.defaultModel || 'deepseek-chat';
      
      const response = await this.chat.completions.create({
        model: modelName,
        messages,
      });

      return response.choices[0]?.message?.content || '';
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