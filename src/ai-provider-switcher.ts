import { OpenAIClient } from './providers/openai.js';
import { DeepseekClient } from './providers/deepseek.js';
import { 
  MCPOptions, 
  CompletionResponse,
  MCPCompletionRequest,
  ProviderConfig,
  Message
} from './types.js';
import { loadConfigFromEnv } from './utils.js';

/**
 * AI提供商切换器(AIProviderSwitcher)
 * 支持管理多个AI提供商，并根据需要动态切换
 */
export class AIProviderSwitcher {
  private options: MCPOptions;
  private providers: Map<string, any> = new Map();
  private defaultProvider: string;

  constructor(options: MCPOptions) {
    this.options = options;
    this.defaultProvider = options.defaultProvider || process.env.DEFAULT_PROVIDER || 'deepseek';

    // 初始化提供商
    this.initProviders();
  }

  /**
   * 初始化提供商实例
   */
  private initProviders() {
    const { providers, configs } = this.options;

    for (const provider of providers) {
      let config: ProviderConfig;

      if (configs && configs[provider]) {
        config = configs[provider];
      } else {
        // 从环境变量加载配置
        config = loadConfigFromEnv(provider) as ProviderConfig;
      }

      try {
        if (provider === 'deepseek') {
          this.providers.set(provider, new DeepseekClient(config));
        } else if (provider === 'openai') {
          this.providers.set(provider, new OpenAIClient(config));
        } else {
          console.warn(`不支持的提供商: ${provider}`);
        }
      } catch (error) {
        console.error(`初始化提供商 ${provider} 失败:`, error);
      }
    }

    // 确保默认提供商已经初始化
    if (!this.providers.has(this.defaultProvider)) {
      throw new Error(`默认提供商 ${this.defaultProvider} 未初始化，请检查配置`);
    }
  }

  /**
   * 获取特定提供商的客户端实例
   */
  public getProvider(provider: string) {
    const client = this.providers.get(provider);
    if (!client) {
      throw new Error(`提供商 ${provider} 未初始化`);
    }
    return client;
  }

  /**
   * 获取当前默认提供商的客户端实例
   */
  public getDefaultProvider() {
    return this.getProvider(this.defaultProvider);
  }

  /**
   * 设置新的默认提供商
   */
  public setDefaultProvider(provider: string) {
    if (!this.providers.has(provider)) {
      throw new Error(`提供商 ${provider} 未初始化，无法设为默认`);
    }
    this.defaultProvider = provider;
  }

  /**
   * 添加新的提供商
   */
  public addProvider(name: string, config: ProviderConfig) {
    if (this.providers.has(name)) {
      throw new Error(`提供商 ${name} 已经存在`);
    }

    try {
      if (name === 'deepseek') {
        this.providers.set(name, new DeepseekClient(config));
      } else if (name === 'openai') {
        this.providers.set(name, new OpenAIClient(config));
      } else {
        throw new Error(`不支持的提供商类型: ${name}`);
      }
    } catch (error) {
      console.error(`添加提供商 ${name} 失败:`, error);
      throw error;
    }
  }

  /**
   * 执行补全请求，自动选择提供商
   */
  public async completions(request: MCPCompletionRequest): Promise<CompletionResponse> {
    const provider = request.provider || this.defaultProvider;
    const client = this.getProvider(provider);
    
    // 删除provider字段，因为实际的客户端API不需要它
    const { provider: _, ...cleanRequest } = request;
    
    // 使用用户选择的模型，不再强制覆盖
    
    return await client.chat.completions.create(cleanRequest);
  }

  /**
   * 简化的文本补全API
   */
  public async complete(prompt: string | Message[], provider?: string): Promise<string> {
    const targetProvider = provider || this.defaultProvider;
    const client = this.getProvider(targetProvider);
    
    return client.complete(prompt);
  }

  /**
   * 创建嵌入向量
   */
  public async createEmbedding(input: string | string[], provider?: string) {
    const targetProvider = provider || this.defaultProvider;
    const client = this.getProvider(targetProvider);
    
    return client.createEmbedding(input);
  }
} 