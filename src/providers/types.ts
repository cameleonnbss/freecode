/**
 * FreeCode — provider type definitions.
 *
 * A Provider is anything that can turn a list of messages into a streamed
 * assistant response. The Agent loop is provider-agnostic.
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ToolCallPart {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultPart {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export type ContentPart = TextPart | ToolCallPart | ToolResultPart;

export interface Message {
  role: Role;
  content: string | ContentPart[];
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ChatRequest {
  model: string;
  messages: Message[];
  system?: string;
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'done'; reason: 'stop' | 'tool_use' | 'length' | 'error'; error?: string };

export interface Provider {
  /** Stable id, e.g. "unlimitedai", "openai", "ollama". */
  id: string;
  /** Display name, e.g. "Unlimited AI (Free)". */
  name: string;
  /** Category for the picker UI. */
  category: 'free' | 'paid' | 'local' | 'custom';
  /** Whether the provider requires a user-supplied API key. */
  requiresApiKey: boolean;
  /** Whether the provider requires a base URL (e.g. local servers). */
  requiresBaseUrl?: boolean;
  /** Optional auth header name override (default: Authorization Bearer). */
  authHeader?: 'bearer' | 'x-api-key' | 'none';
  /** Stream a chat completion. Yields StreamEvent objects. */
  stream(req: ChatRequest): AsyncIterable<StreamEvent>;
  /** List available models for this provider (best-effort). */
  listModels?(): Promise<ModelInfo[]>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider?: string;
  tier?: 'flagship' | 'standard' | 'fast' | 'reasoning' | 'local';
  contextWindow?: number;
}

/** A configured provider instance (provider + user credentials). */
export interface ProviderConfig {
  id: string;
  providerId: string;
  label: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled: boolean;
}

export interface ModelRef {
  providerConfigId: string;
  model: string;
}
