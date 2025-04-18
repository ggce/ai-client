import dotenv from 'dotenv';
import { ClientOptions } from './types';

// 加载环境变量
dotenv.config();

/**
 * 从环境变量中加载配置
 */
export function loadConfigFromEnv(provider: string = 'deepseek'): ClientOptions {
  const config: ClientOptions = {
    timeout: 60000,
    maxRetries: 3,
  };

  if (provider === 'deepseek') {
    config.apiKey = process.env.DEEPSEEK_API_KEY || '';
    config.baseUrl = process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com';
    config.defaultModel = 'deepseek-chat';
  } else if (provider === 'openai') {
    config.apiKey = process.env.OPENAI_API_KEY || '';
    config.baseUrl = process.env.OPENAI_API_BASE_URL;
    config.defaultModel = 'gpt-3.5-turbo';
  }

  return config;
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 实现指数退避重试
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; baseDelay?: number } = { maxRetries: 3, baseDelay: 1000 }
): Promise<T> {
  const { maxRetries, baseDelay = 1000 } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delayTime = baseDelay * Math.pow(2, attempt);
        await delay(delayTime);
      }
    }
  }

  throw lastError;
}

/**
 * 生成UUID
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
} 