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

export class OpenAIClient {
  private client: OpenAI;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey || process.env.OPENAI_API_KEY,
      baseUrl: options.baseUrl || process.env.OPENAI_API_BASE_URL,
      defaultModel: options.defaultModel || 'gpt-3.5-turbo',
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    };

    if (!this.options.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: this.options.apiKey,
      baseURL: this.options.baseUrl,
      timeout: this.options.timeout,
      maxRetries: this.options.maxRetries,
    });
  }

  public chat = {
    completions: {
      create: async (request: CompletionRequest): Promise<CompletionResponse> => {
        const model = request.model || this.options.defaultModel || 'gpt-3.5-turbo';
        
        return withRetry(
          async () => {
            const response = await this.client.chat.completions.create({
              ...request,
              model: model as string, // 确保model是字符串类型
              stream: false
            }) as ChatCompletion;
            
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
        const model = request.model || this.options.defaultModel || 'gpt-3.5-turbo';
        
        const stream = await this.client.chat.completions.create({
          ...request,
          model: model as string, // 确保model是字符串类型
          stream: true,
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
      model: this.options.defaultModel || 'gpt-3.5-turbo',
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