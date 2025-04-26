import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';

/**
 * 提供商类型
 */
export type Provider = 'deepseek' | 'openai' | 'gemini' | 'anthropic' | 'qwen';

/**
 * 提供商配置
 */
export interface ProviderConfig {
  apiKey: string;
  baseURL: string;
  model: string;
}

/**
 * 设置状态
 */
export interface SettingsState {
  providers: {
    [key: string]: ProviderConfig;
  };
  currentProvider: Provider;
  isSidebarCollapsed: boolean;
  isSessionSidebarCollapsed?: boolean;
  selectedTools?: string[]; // 存储选中的工具名称数组
}

/**
 * 聊天请求配置
 */
export interface ChatRequestConfig {
  apiKey: string;
  baseURL?: string;
}

/**
 * 聊天请求
 */
export interface ChatRequest {
  message: string;
  provider: string;
  model: string;
  config: ChatRequestConfig;
  stream?: boolean;
  sessionHistory?: Array<{ type: 'user' | 'assistant' | 'system' | 'tool', content: string }>;
}

/**
 * 聊天响应
 */
export interface ChatResponse {
  reply: string;
  reasoningContent?: string;
}

/**
 * 会话配置
 */
export interface SessionConfig {
  provider?: string;
  model?: string;
  config?: ChatRequestConfig;
}

/**
 * 会话消息
 */
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<ChatCompletionMessageToolCall>;
  toolCallId?: string;
  reasoningContent?: string;
}

/**
 * 会话
 */
export interface Session {
  id: string;
}

/**
 * 消息选项
 */
export interface MessageOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

/**
 * 消息响应
 */
export interface MessageResponse {
  content: string;
  role: 'assistant';
  reasoningContent?: string;
}

/**
 * 消息回调参数
 */
export interface MessageCallbackParams {
  content: string;
  reasoningContent: string;
  toolCall: any; // 工具调用数据
  isMessageUpdate: boolean;
}

/**
 * DeepSeek余额信息
 */
export interface DeepSeekBalanceInfo {
  currency: 'CNY' | 'USD';
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
}

/**
 * DeepSeek余额响应
 */
export interface DeepSeekBalanceResponse {
  is_available: boolean;
  balance_infos: DeepSeekBalanceInfo[];
}

export interface ToolCall {
  index: number;
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<ToolCall>
  reasoningContent?: string // 添加推理内容字段
}

/**
 * Tips组件暴露的方法接口
 */
export interface TipsExpose {
  show: (message: string, type: 'info' | 'success' | 'warning' | 'error', duration: number) => { close: () => void };
  hide: () => void;
}

/**
 * 全局窗口接口扩展
 */
declare global {
  interface Window {
    __GLOBAL_TIPS_INSTANCE__: TipsExpose | null;
  }
}