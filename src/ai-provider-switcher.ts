import { 
  MCPOptions, 
  ProviderConfig,
} from './types.js';
import { loadConfigFromEnv } from './utils.js';
import { AIProviderFactory } from './providers/aiProviderFactory';
import { BaseClient } from './providers/baseClient';
import { ProviderType, SUPPORTED_PROVIDERS } from './constants';
import logger from './logger';

/**
 * AI提供商切换器(AIProviderSwitcher)
 * 支持管理多个AI提供商，并根据需要动态切换
 */
export class AIProviderSwitcher {
  private options: MCPOptions;
  private providers: Map<string, BaseClient> = new Map();
  private defaultProvider: string;

  constructor(options: MCPOptions) {
    this.options = options;
    this.defaultProvider = options.defaultProvider || process.env.DEFAULT_PROVIDER || SUPPORTED_PROVIDERS[0];

    // 初始化提供商
    this.initProviders();
  }

  /**
   * 检查提供商是否受支持
   */
  private isSupportedProvider(provider: string): provider is ProviderType {
    return SUPPORTED_PROVIDERS.includes(provider as ProviderType);
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
        config = loadConfigFromEnv(provider as ProviderType) as ProviderConfig;
      }

      try {
        if (this.isSupportedProvider(provider)) {
          // 使用工厂创建提供商
          const client = AIProviderFactory.getProvider(provider, config);
          this.providers.set(provider, client);
        } else {
          logger.warn('AIProviderSwitcher', `不支持的提供商: ${provider}`);
        }
      } catch (error) {
        logger.error('AIProviderSwitcher', `初始化提供商 ${provider} 失败: ${error}`);
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
  public getProvider(provider: string): BaseClient {
    const client = this.providers.get(provider);
    if (!client) {
      throw new Error(`提供商 ${provider} 未初始化`);
    }
    return client;
  }

  /**
   * 获取当前默认提供商的客户端实例
   */
  public getDefaultProvider(): BaseClient {
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
      if (this.isSupportedProvider(name)) {
        // 使用工厂创建提供商
        const client = AIProviderFactory.getProvider(name, config);
        this.providers.set(name, client);
      } else {
        throw new Error(`不支持的提供商类型: ${name}`);
      }
    } catch (error) {
      logger.error('AIProviderSwitcher', `添加提供商 ${name} 失败: ${error}`);
      throw error;
    }
  }

  /**
   * 创建嵌入向量
   */
  public async createEmbedding(input: string | string[], provider?: string) {
    const targetProvider = provider || this.defaultProvider;
    const client = this.getProvider(targetProvider);
    
    if ('createEmbedding' in client) {
      return (client as any).createEmbedding(input);
    } else {
      throw new Error(`提供商 ${targetProvider} 不支持嵌入向量功能`);
    }
  }
} 