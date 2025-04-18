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

// 使用OpenAI SDK连接DeepSeek API的客户端实现
export class DeepseekClient {
  private client: OpenAI;
  private options: ClientOptions;

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