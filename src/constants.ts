/**
 * API 服务相关常量
 */

// OpenAI默认API地址
export const OPENAI_DEFAULT_URL = 'https://api.openai.com/v1';

// DeepSeek默认API地址
export const DEEPSEEK_DEFAULT_URL = 'https://api.deepseek.com';

// Gemini默认API地址
export const GEMINI_DEFAULT_URL = 'https://generativelanguage.googleapis.com';

/**
 * OpenAI模型常量
 */
export const OPENAI_MODELS = {
  DEFAULT: 'gpt-4.1',
  GPT_4_1: 'gpt-4.1',
  GPT_4_1_MINI: 'gpt-4.1-mini',
  GPT_4_1_NANO: 'gpt-4.1-nano',
  O3_MINI: 'o3-mini'
};

/**
 * Deepseek模型常量
 */
export const DEEPSEEK_MODELS = {
  DEFAULT: 'deepseek-chat',
  DEEPSEEK_CHAT: 'deepseek-chat',
  DEEPSEEK_CODER: 'deepseek-coder',
  DEEPSEEK_REASONER: 'deepseek-reasoner',
  ALL: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner']
};

/**
 * Gemini模型常量
 */
export const GEMINI_MODELS = {
  DEFAULT: 'gemini-2.0-flash',
  GEMINI_2_0_FLASH: 'gemini-2.0-flash',
  GEMINI_2_0_PRO: 'gemini-2.0-pro',
  GEMINI_1_5_PRO: 'gemini-1.5-pro',
  GEMINI_1_5_FLASH: 'gemini-1.5-flash',
  GEMINI_2_5_PRO_EXP: 'gemini-2.5-pro-exp-03-25',
  GEMINI_2_5_FLASH_PREVIEW: 'gemini-2.5-flash-preview-04-17',
  ALL: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.5-pro-exp-03-25', 'gemini-2.5-flash-preview-04-17']
}; 