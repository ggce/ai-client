import { BaseClient } from './baseClient';
import { DeepseekClient, OpenAIClient, GeminiClient, AnthropicClient, QwenClient } from './openai';
import { ClientOptions } from '../types';

export type ProviderType = 'deepseek' | 'openai' | 'gemini' | 'anthropic' | 'qwen';

export class AIProviderFactory {
  private static providers: Record<ProviderType, BaseClient> = {} as any;

  // 获取或创建提供商实例
  public static getProvider(type: ProviderType, options?: ClientOptions): BaseClient {
    if (!this.providers[type]) {
      this.createProvider(type, options);
    } else if (options) {
      // 如果提供了新的选项，更新现有实例
      this.providers[type].updateOptions(options);
    }
    
    return this.providers[type];
  }

  // 创建新的提供商实例
  private static createProvider(type: ProviderType, options?: ClientOptions): void {
    switch (type) {
      case 'deepseek':
        this.providers[type] = new DeepseekClient(options);
        break;
      case 'openai':
        this.providers[type] = new OpenAIClient(options);
        break;
      case 'gemini':
        this.providers[type] = new GeminiClient(options);
        break;
      case 'anthropic':
        this.providers[type] = new AnthropicClient(options);
        break;
      case 'qwen':
        this.providers[type] = new QwenClient(options);
        break;
      default:
        throw new Error(`不支持的提供商类型: ${type}`);
    }
  }
} 