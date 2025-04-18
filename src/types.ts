export type Role = 'user' | 'assistant' | 'system';

export interface Message {
  role: Role;
  content: string;
  name?: string;
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

export interface FunctionDefinition {
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
    function_call?: FunctionCall;
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
  baseUrl?: string;
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
  baseUrl?: string;
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
  };
  finish_reason?: string | null;
} 