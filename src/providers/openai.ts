// openai调用风格
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { 
  ClientOptions, 
  Message,
  MCPTool,
} from '../types';
import {
  ProviderType,
  SUPPORTED_PROVIDERS,
  getProviderConfig
} from '../constants';
import * as constants from '../constants';
import logger from '../logger';
import { BaseClient } from './baseClient';

/**
 * 支持OpenAI兼容API的通用客户端实现
 * 支持会话管理和流式API
 */
export class UnifiedClient extends BaseClient {
  private provider: ProviderType;

  constructor(options: ClientOptions & { provider?: ProviderType } = {}) {
    const provider = options.provider || SUPPORTED_PROVIDERS[0];
    let baseURL = options.baseURL;
    let defaultModel = options.defaultModel;
    
    // 根据提供商选择正确的默认URL和模型
    if (!baseURL) {
      const providerConfig = getProviderConfig(provider);
      baseURL = providerConfig.DEFAULT_URL;
    }
    
    // 设置默认模型
    if (!defaultModel) {
      const providerConfig = getProviderConfig(provider);
      defaultModel = providerConfig.DEFAULT_MODEL;
    }
    
    super({
      apiKey: options.apiKey || '',
      baseURL,
      defaultModel,
      timeout: options.timeout || 180000,
      maxRetries: options.maxRetries || 5,
    }, `${provider.charAt(0).toUpperCase() + provider.slice(1)}Client`);
    
    this.provider = provider;
    logger.log(this.loggerPrefix, `初始化客户端完成，提供商: ${provider}, baseURL: ${baseURL}, 默认模型: ${defaultModel}`);
  }

  // 检查模型是否为DeepSeek推理模型
  private isReasonerModel(model: string): boolean {
    return this.provider === 'deepseek' && model === 'deepseek-reasoner';
  }

  public chat = {
    completions: {
      // 流式API
      createStream: async (params: {
        model: string;
        messages: Array<Message>;
        mcpTools?: Array<MCPTool>,
        signal?: AbortSignal
      }) => {
        // 确保消息格式正确
        const messages = params.messages.map(msg => ({
          role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
          content: msg.content,
          tool_calls: msg.toolCalls,
          tool_call_id: msg.toolCallId,
        }));

        try {
          // 检查abort信号是否已被触发
          if (params.signal?.aborted) {
            logger.log(this.loggerPrefix, '请求已被中止，不发送API请求');
            throw new DOMException('请求已被用户中止', 'AbortError');
          }

          // 确保model不会为undefined，使用默认模型
          const modelName = params.model || this.options.defaultModel;
          
          // 防止模型为undefined
          if (!modelName) {
            throw new Error('未指定模型，且无默认模型可用');
          }
          
          // 添加abort信号监听器
          if (params.signal) {
            logger.log(this.loggerPrefix, '设置AbortSignal监听器');
            params.signal.addEventListener('abort', () => {
              logger.log(this.loggerPrefix, 'AbortSignal已被触发，流式请求将被中止');
            });
          }
          
          // 处理 Reasoner 模型不支持工具调用的情况
          const isReasoner = this.isReasonerModel(modelName);
          
          // 如果是 Reasoner 模型，过滤掉工具调用、响应消息
          const filteredMessages = isReasoner ? messages.filter(msg => !msg.tool_calls && msg.role !== 'tool') : messages;
          // 如果是 Reasoner 模型，过滤掉工具
          const filteredTools = isReasoner ? undefined : params.mcpTools?.map(tool => ({
            type: 'function' as const,
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters
            }
          }));
          
          // 准备正确类型的API请求参数
          const requestParams = {
            model: modelName,
            messages: filteredMessages as ChatCompletionMessageParam[],
            // 确保stream为true (流式)
            stream: true as const,
            max_tokens: 8192,
            temperature: 0.7,
            tools: filteredTools,
            // 传递中止信号
            signal: params.signal,
          };

          // 验证流对象 - 更详细的日志
          logger.log(this.loggerPrefix, `流式请求开始: ${JSON.stringify(requestParams).substring(0, 100)}`);
          logger.log(this.loggerPrefix, `请求options: ${JSON.stringify(this.options).substring(0, 100)}`);

          // 发送请求
          const stream = await this.client.chat.completions.create(requestParams);
          
          return stream;
        } catch (error) {
          // 检查是否是中止错误
          if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort'))) {
            logger.log(this.loggerPrefix, `流式请求被用户中止: ${error.message}`);
            // 重新抛出AbortError以确保正确处理
            throw new DOMException('请求已被用户中止', 'AbortError');
          } else {
            logger.error(this.loggerPrefix, `流式API请求失败: ${error}`);
          }
          throw error;
        }
      },
    },
  };
}

// 创建具名导出的客户端类
export class DeepseekClient extends UnifiedClient {
  constructor(options: ClientOptions = {}) {
    super({ ...options, provider: 'deepseek' });
  }
}

export class QwenClient extends UnifiedClient {
  constructor(options: ClientOptions = {}) {
    super({ ...options, provider: 'qwen' });
  }
}

export class QingyunClient extends UnifiedClient {
  constructor(options: ClientOptions = {}) {
    super({ ...options, provider: 'qingyun' });
  }
}