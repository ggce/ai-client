import { ChatCompletionMessageToolCall, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { 
  ClientOptions, 
  Message,
  MCPTool,
} from '../types';
import { withRetry, generateUUID } from '../utils';
import { OPENAI_DEFAULT_URL, OPENAI_MODELS } from '../constants';
import logger from '../logger';
import { BaseClient } from './baseClient';

/**
 * 使用OpenAI SDK连接OpenAI API的客户端实现
 * 支持会话管理和流式API
 */
export class OpenAIClient extends BaseClient {
  constructor(options: ClientOptions = {}) {
    super({
      apiKey: options.apiKey || '',
      baseURL: options.baseURL || OPENAI_DEFAULT_URL,
      defaultModel: options.defaultModel || OPENAI_MODELS.DEFAULT,
      timeout: options.timeout || 60000,
      maxRetries: options.maxRetries || 3,
    }, 'OpenAIClient');
    
    logger.log(this.loggerPrefix, '初始化客户端完成');
  }

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
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id,
          tool_calls: msg.tool_calls,
        })) as ChatCompletionMessageParam[];

        try {
          // 确保model不会为undefined
          const modelName = params.model || this.options.defaultModel || OPENAI_MODELS.DEFAULT;
          
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
          logger.log(this.loggerPrefix, `流式响应开始: ${JSON.stringify(requestParams)}`);

          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          return stream;
        } catch (error) {
          logger.error(this.loggerPrefix, `流式API请求失败: ${error}`);
          throw error;
        }
      },
    },
  };

  // 嵌入API
  public async createEmbedding(input: string | string[]) {
    const textInput = Array.isArray(input) ? input : [input];
    
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-ada-002',
        input: textInput,
      });
      
      logger.log(this.loggerPrefix, `嵌入API响应成功`);
      return response;
    } catch (error) {
      logger.error(this.loggerPrefix, `嵌入API请求失败: ${error}`);
      throw error;
    }
  }
} 