/**
 * API 服务相关常量
 */

export const API_VERSION = 'v0';

// OpenAI对应的服务
export const OPENAI_DEFAULT_URL: string = 'https://api.openai.com/v1';
export const OPENAI_MODELS = {
  DEFAULT: 'gpt-4.1',
  GPT_3_5: 'gpt-3.5-turbo',
  GPT_4: 'gpt-4',
  GPT_4_TURBO: 'gpt-4-turbo-preview',
  GPT_4_1: 'gpt-4.1',
  GPT_4_1_MINI: 'gpt-4.1-mini',
  GPT_4_1_NANO: 'gpt-4.1-nano',
  O3_MINI: 'o3-mini',
};

// DeepSeek对应的服务
export const DEEPSEEK_DEFAULT_URL: string = 'https://api.deepseek.com/v1';
export const DEEPSEEK_MODELS = {
  DEFAULT: 'deepseek-chat',
  DEEPSEEK_CHAT: 'deepseek-chat',
  DEEPSEEK_CODER: 'deepseek-coder',
  DEEPSEEK_REASONER: 'deepseek-reasoner',
  ALL: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
};

// Gemini对应的服务
export const GEMINI_DEFAULT_URL: string = 'https://generativelanguage.googleapis.com/v1beta';
export const GEMINI_MODELS = {
  DEFAULT: 'gemini-2.0-flash',
  GEMINI_PRO: 'gemini-pro',
  GEMINI_2_0_FLASH: 'gemini-2.0-flash',
  GEMINI_2_0_PRO: 'gemini-2.0-pro',
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
  GEMINI_1_5_FLASH: 'gemini-1.5-flash',
  GEMINI_2_5_PRO_EXP: 'gemini-2.5-pro-exp-03-25',
  GEMINI_2_5_FLASH_PREVIEW: 'gemini-2.5-flash-preview-04-17',
  ALL: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-pro-exp-03-25', 'gemini-2.5-flash-preview-04-17']
};

// Anthropic对应的服务
export const ANTHROPIC_DEFAULT_URL: string = 'https://api.anthropic.com';
export const ANTHROPIC_MODELS = {
  DEFAULT: 'claude-3-7-sonnet-20250219',
  CLAUDE_OPUS: 'claude-3-opus-20240229',
  CLAUDE_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_HAIKU: 'claude-3-haiku-20240307',
  CLAUDE_3_7_SONNET: 'claude-3-7-sonnet-20250219',
  CLAUDE_3_7_SONNET_THINKING: 'claude-3-7-sonnet-20250219-thinking',
  ALL: ['claude-3-7-sonnet-20250219', 'claude-3-7-sonnet-20250219-thinking']
};

// Qwen对应的服务
export const QWEN_DEFAULT_URL: string = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const QWEN_MODELS = {
  DEFAULT: 'qwen-max-latest',
  QWEN_MAX: 'qwen-max-latest',
  QWEN_TURBO: 'qwen-turbo',
  ALL: ['qwen-max-latest', 'qwen-turbo']
}; 