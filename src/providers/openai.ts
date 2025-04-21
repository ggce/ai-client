import { OpenAI } from 'openai';
import type { ChatCompletion } from 'openai/resources/chat';
import { 
  ClientOptions, 
  CompletionRequest, 
  CompletionResponse,
  Message,
  FunctionCall
} from '../types';
import { withRetry } from '../utils';
import { OPENAI_DEFAULT_URL, OPENAI_MODELS } from '../constants';

export class OpenAIClient {
  private client: OpenAI;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey || '',
      baseURL: options.baseURL || OPENAI_DEFAULT_URL,
      defaultModel: options.defaultModel || OPENAI_MODELS.DEFAULT,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    };

    // API key可以为空，由用户在使用时提供
    this.client = new OpenAI({
      apiKey: this.options.apiKey || 'dummy-key', // 使用dummy-key防止OpenAI SDK初始化错误
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries,
    });
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
      apiKey: this.options.apiKey || 'dummy-key', // 使用dummy-key防止OpenAI SDK初始化错误
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries
    });
    
    console.log('已更新OpenAI客户端配置');
  }

  public chat = {
    completions: {
      create: async (request: CompletionRequest): Promise<CompletionResponse> => {
        const model = request.model || this.options.defaultModel || OPENAI_MODELS.DEFAULT;
        
        return withRetry(
          async () => {
            const response = await this.client.chat.completions.create({
              ...request,
              model: model as string, // 确保model是字符串类型
              stream: false,
              messages: request.messages.map(msg => {
                const message: any = {
                  role: msg.role,
                  content: msg.content
                };
                if (msg.name) message.name = msg.name;
                // Only add function_call if it exists on the message
                if ('function_call' in msg) message.function_call = msg.function_call;
                return message;
              }) as any
            }) as ChatCompletion;

            console.log('OpenAI响应: ', response);
            
            // 将OpenAI响应转换为通用格式
            return {
              id: response.id,
              object: response.object,
              created: Math.floor(Date.now() / 1000),
              model: response.model,
              choices: response.choices.map((choice: any) => ({
                index: choice.index,
                message: {
                  role: choice.message.role,
                  content: choice.message.content,
                  function_call: choice.message.function_call ? {
                    name: choice.message.function_call.name,
                    arguments: choice.message.function_call.arguments,
                  } as FunctionCall : undefined,
                },
                finish_reason: choice.finish_reason as 'stop' | 'length' | 'function_call',
              })),
              usage: response.usage || {
                prompt_tokens: 0,
                completion_tokens: 0,
                total_tokens: 0,
              },
            };
          },
          { maxRetries: this.options.maxRetries || 3 }
        );
      },

      // Stream API支持
      createStream: async (request: CompletionRequest) => {
        const model = request.model || this.options.defaultModel || OPENAI_MODELS.DEFAULT;
        
        const stream = await this.client.chat.completions.create({
          ...request,
          model: model as string, // 确保model是字符串类型
          stream: true,
          messages: request.messages.map(msg => {
            const message: any = {
              role: msg.role,
              content: msg.content
            };
            if (msg.name) message.name = msg.name;
            if ('function_call' in msg) message.function_call = msg.function_call;
            return message;
          }) as any
        });

        return stream;
      },
    },
  };

  // 简化的文本补全API
  public async complete(prompt: string | Message[]): Promise<string> {
    let messages: Message[];
    
    if (typeof prompt === 'string') {
      messages = [{ role: 'user', content: prompt }];
    } else {
      messages = prompt;
    }

    const response = await this.chat.completions.create({
      model: this.options.defaultModel || OPENAI_MODELS.DEFAULT,
      messages,
    });

    return response.choices[0]?.message?.content || '';
  }

  // 嵌入API
  public async createEmbedding(input: string | string[]) {
    const textInput = Array.isArray(input) ? input : [input];
    
    const response = await this.client.embeddings.create({
      model: 'text-embedding-ada-002',
      input: textInput,
    });
    
    return response;
  }
} 