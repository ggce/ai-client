/**
 * API 服务相关常量
 */

// Provider 配置接口
export interface ProviderConstantConfig {
  NAME: string;
  DEFAULT_URL: string;
  DEFAULT_MODEL: string;
  ALL_MODELS: string[];
}

// 所有 Provider 配置
export const PROVIDER_CONFIGS: Record<string, ProviderConstantConfig> = {
  DEEPSEEK: {
    NAME: 'deepseek',
    DEFAULT_URL: 'https://api.deepseek.com/v1',
    DEFAULT_MODEL: 'deepseek-chat',
    ALL_MODELS: [
      'deepseek-chat',
      'deepseek-reasoner'
    ]
  },
  QWEN: {
    NAME: 'qwen',
    DEFAULT_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    DEFAULT_MODEL: 'qwen-max-latest',
    ALL_MODELS: [
      'qwen-max-latest',
      'qwen-turbo',
      'qwen3-32b'
    ]
  },
  ERNIE: {
    NAME: 'ernie',
    DEFAULT_URL: 'https://qianfan.baidubce.com/v2',
    DEFAULT_MODEL: 'ernie-4.5-turbo-128k',
    ALL_MODELS: [
      'ernie-4.5-turbo-128k',
      'ernie-4.5-turbo-32k',
      'ernie-4.0-turbo-128k',
      'ernie-4.0-turbo-8k'
    ]
  },
  DOUBAO: {
    NAME: 'doubao',
    DEFAULT_URL: 'https://ark.cn-beijing.volces.com/api/v3',
    DEFAULT_MODEL: 'doubao-1-5-pro-32k-250115',
    ALL_MODELS: [
      'doubao-seed-1-6-250615',
      'doubao-seed-1-6-flash-250615',
      'doubao-1-5-pro-32k-250115',
      'doubao-1-5-thinking-pro-250415',
    ]
  },
  GLM: {
    NAME: 'glm',
    DEFAULT_URL: 'https://open.bigmodel.cn/api/paas/v4/',
    DEFAULT_MODEL: 'glm-4-plus',
    ALL_MODELS: [
      'glm-4-plus',
      'GLM-4-Air-250414',
      'GLM-4-AirX',
      'glm-4',
    ]
  },
  QINGYUN: {
    NAME: 'qingyun',
    DEFAULT_URL: 'https://api.qingyuntop.top/v1',
    DEFAULT_MODEL: 'gpt-4.1-2025-04-14',
    ALL_MODELS: [
      'gpt-4.1-2025-04-14',
      'gpt-4.1-mini-2025-04-14',
      'gpt-4.1-nano-2025-04-14',
      'claude-3-7-sonnet-20250219-thinking',
      'claude-3-7-sonnet-20250219',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-20250514-thinking',
      'gemini-2.0-flash',
      'gemini-2.5-pro-exp-03-25',
      'gemini-2.5-flash-preview-05-20',
      'glm-3-turbo',
      'deepseek-r1-searching',
      'deepseek-chat',
      'doubao-1-5-pro-32k-250115'
    ]
  },
  OPENROUTER: {
    NAME: 'openrouter',
    DEFAULT_URL: 'https://openrouter.ai/api/v1',
    DEFAULT_MODEL: 'google/gemini-2.0-flash-exp:free',
    ALL_MODELS: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-4-maverick:free',
      'nousresearch/deephermes-3-mistral-24b-preview:free'
    ]
  },
  WOKAAI: {
    NAME: 'wokaai',
    DEFAULT_URL: 'https://4.0.wokaai.com/v1',
    DEFAULT_MODEL: 'claude-sonnet-4-20250514',
    ALL_MODELS: [
      'claude-sonnet-4-20250514',
    ]
  },
} as const;

// 支持的AI提供商
export const SUPPORTED_PROVIDERS = Object.values(PROVIDER_CONFIGS).map(config => config.NAME);
export type ProviderType = (typeof SUPPORTED_PROVIDERS)[number];

// 根据提供商类型获取配置
export function getProviderConfig(provider: ProviderType): ProviderConstantConfig {
  const config = Object.values(PROVIDER_CONFIGS).find(cfg => cfg.NAME === provider);
  if (!config) {
    throw new Error(`未知的provider: ${provider}`);
  }
  return config;
}