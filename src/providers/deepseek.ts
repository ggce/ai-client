import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { 
  ClientOptions, 
  CompletionRequest, 
  CompletionResponse,
  Message
} from '../types';
import { generateUUID, withRetry } from '../utils';

export class DeepseekClient {
  private client: AxiosInstance;
  private options: ClientOptions;

  constructor(options: ClientOptions = {}) {
    this.options = {
      apiKey: options.apiKey || process.env.DEEPSEEK_API_KEY,
      baseUrl: options.baseUrl || process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com',
      defaultModel: options.defaultModel || 'deepseek-v3-lite',
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    };

    if (!this.options.apiKey) {
      throw new Error('Deepseek API key is required');
    }

    console.log('DeepSeek API Base URL:', this.options.baseUrl);

    this.client = axios.create({
      baseURL: this.options.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.apiKey}`,
      },
      timeout: this.options.timeout,
    });
  }

  public chat = {
    completions: {
      create: async (request: CompletionRequest): Promise<CompletionResponse> => {
        const model = request.model || this.options.defaultModel;
        
        // 修正请求参数
        const payload = {
          ...request,
          model,
        };

        console.log('DeepSeek API请求参数:', JSON.stringify(payload, null, 2));

        try {
          return await withRetry(
            async () => {
              const response = await this.client.post('/v1/chat/completions', payload);
              return response.data;
            },
            { maxRetries: this.options.maxRetries || 3 }
          );
        } catch (error: any) {
          console.error('DeepSeek API错误:', error.message);
          if (error.response) {
            console.error('状态码:', error.response.status);
            console.error('响应:', error.response.data);
          }
          throw error;
        }
      },

      // Stream API支持
      createStream: async (request: CompletionRequest) => {
        const client = this.client;
        const model = request.model || this.options.defaultModel;
        
        // 构建请求参数
        const payload = {
          ...request,
          model,
          stream: true,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.max_tokens ?? 2048,
        };

        console.log('DeepSeek流式请求模型:', model);
        console.log('DeepSeek流式请求参数:', JSON.stringify(payload, null, 2));

        try {
          const response = await client.post('/v1/chat/completions', payload, {
            responseType: 'stream',
          });

          console.log('DeepSeek流式响应开始');
          
          const generator = async function* () {
            for await (const chunk of response.data) {
              const lines = chunk
                .toString()
                .split('\n')
                .filter((line: string) => line.trim() !== '');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    return;
                  }
                  try {
                    const parsedData = JSON.parse(data);
                    yield parsedData;
                  } catch (e) {
                    console.error('Error parsing SSE data:', e);
                  }
                }
              }
            }
          };

          return generator();
        } catch (error: any) {
          console.error('DeepSeek流式API错误:', error.message);
          if (error.response) {
            console.error('状态码:', error.response.status);
            try {
              const responseData = await error.response.data.toString();
              console.error('错误响应:', responseData);
            } catch (e) {
              console.error('无法读取响应数据:', e);
            }
          }
          throw error;
        }
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

    try {
      const response = await this.chat.completions.create({
        model: this.options.defaultModel || 'deepseek-v3-lite',
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
      model: 'embedding-model',
      input: Array.isArray(input) ? input : [input],
    };

    try {
      const response = await this.client.post('/v1/embeddings', payload);
      return response.data;
    } catch (error: any) {
      console.error('DeepSeek嵌入请求错误:', error.message);
      throw error;
    }
  }
} 