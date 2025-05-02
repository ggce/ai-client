import { BaseClient } from './baseClient';
import { UnifiedClient } from './openai';
import { ClientOptions } from '../types';
import { ProviderType } from '../constants';

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
    this.providers[type] = new UnifiedClient({ ...options, provider: type });
  }
} 