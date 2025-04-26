// 导出所有类型
export * from './types';

// 导出实用工具
export * from './utils';

// 导出提供商客户端类
export { OpenAIClient } from './providers/openai';
export { DeepseekClient } from './providers/openai';
export { AIProviderSwitcher } from './ai-provider-switcher';

// 创建默认客户端实例
import { OpenAIClient } from './providers/openai';
import { DeepseekClient } from './providers/openai';
import { ProviderConfig } from './types';
import { loadConfigFromEnv } from './utils';
import { AIProviderSwitcher } from './ai-provider-switcher';

// 创建默认的Deepseek客户端
const defaultDeepseekClient = new DeepseekClient(
  loadConfigFromEnv('deepseek') as ProviderConfig
);

// 创建默认的OpenAI客户端
const defaultOpenAIClient = new OpenAIClient(
  loadConfigFromEnv('openai') as ProviderConfig
);

// 创建默认的AI提供商切换器
const defaultProviderSwitcher = new AIProviderSwitcher({
  defaultProvider: process.env.DEFAULT_PROVIDER || 'deepseek',
  providers: ['deepseek', 'openai', 'gemini']
});

// 导出默认实例
export {
  defaultDeepseekClient,
  defaultOpenAIClient,
  defaultProviderSwitcher as defaultMCPClient // 保留兼容性
}; 