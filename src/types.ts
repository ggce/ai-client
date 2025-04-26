import { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions';

export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  role: Role;
  content: string;
  name?: string;
  reasoningContent?: string;
  tool_calls?: Array<ChatCompletionMessageToolCall>,
  tool_call_id?: string; // 为工具消息添加的可选字段
  timestamp?: number; // 添加时间戳字段
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  presence_penalty?: number;
  frequency_penalty?: number;
  stop?: string | string[];
  top_k?: number;
  seed?: number;
  logit_bias?: Record<string, number>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface CompletionChoice {
  index: number;
  message: {
    role: Role;
    content: string | null;
    tool_calls?: Array<ChatCompletionMessageToolCall>;  
    reasoningContent?: string;
  };
  finish_reason: 'stop' | 'length' | 'function_call';
}

export interface CompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: CompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
  organizationId?: string;
  [key: string]: any;
}

export interface MCPOptions {
  defaultProvider: string;
  providers: string[];
  configs?: Record<string, ProviderConfig>;
}

export interface MCPCompletionRequest extends Omit<CompletionRequest, 'model'> {
  provider?: string;
  model?: string;
}

export type ClientOptions = {
  apiKey?: string;
  baseURL?: string;
  organizationId?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface DeltaChoice {
  index?: number;
  delta: {
    role?: Role;
    content?: string;
    function_call?: Partial<FunctionCall>;
    reasoningContent?: string;
  };
  finish_reason?: string | null;
} 