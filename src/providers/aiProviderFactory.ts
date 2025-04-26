import { BaseClient } from './baseClient';
import { DeepseekClient } from './openai';
import { OpenAIClient } from './openai';
import { ClientOptions } from '../types';

export type ProviderType = 'deepseek' | 'openai' | 'gemini';

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
        // 使用OpenAI客户端代替Gemini客户端，通过第三方代理使用OpenAI风格调用Gemini
        this.providers[type] = new OpenAIClient(options);
        break;
      default:
        throw new Error(`不支持的提供商类型: ${type}`);
    }
  }
} 