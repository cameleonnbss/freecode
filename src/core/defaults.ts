/**
 * FreeCode — default config + provider catalogue.
 *
 * The catalogue lists every provider FreeCode knows how to talk to.
 * Free providers (Unlimited AI) are pre-configured so the app works on
 * first launch without any setup. Paid/local providers just need a key
 * or a base URL.
 */
import type { ProviderConfig } from '../providers/types.js';

export interface AppConfig {
  version: number;
  language: 'fr' | 'en' | 'auto';
  theme: 'neon' | 'minimal' | 'matrix';
  activeProviderId: string;
  activeModel: string;
  providers: ProviderConfig[];
  /** Whether to auto-confirm tool executions (dangerous). */
  autoConfirmTools: boolean;
  /** Default agent persona id. */
  defaultAgent: string;
  /** Whether to persist chat history. */
  saveHistory: boolean;
}

export const CONFIG_VERSION = 1;

export function defaultConfig(): AppConfig {
  return {
    version: CONFIG_VERSION,
    language: 'auto',
    theme: 'neon',
    activeProviderId: 'unlimitedai-default',
    activeModel: 'gateway-claude-opus-4-7',
    providers: [
      {
        id: 'unlimitedai-default',
        providerId: 'unlimitedai',
        label: 'Unlimited AI (Free)',
        baseUrl: 'https://unlimited.surf',
        apiKey: '',
        defaultModel: 'gateway-claude-opus-4-7',
        enabled: true,
      },
    ],
    autoConfirmTools: false,
    defaultAgent: 'default',
    saveHistory: true,
  };
}

/** Catalogue of supported providers (metadata only — credentials live in config). */
export interface ProviderCatalogEntry {
  providerId: string;
  name: string;
  category: 'free' | 'paid' | 'local' | 'custom';
  description: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  signupUrl?: string;
  docsUrl?: string;
  popularModels?: { id: string; name: string; tier?: string }[];
}

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    providerId: 'unlimitedai',
    name: 'Unlimited AI',
    category: 'free',
    description: 'Free gateway to GPT-5, Claude Opus, Gemini, DeepSeek, Grok, Qwen, Llama. IP-bound key, no credit card.',
    requiresApiKey: false,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://unlimited.surf',
    docsUrl: 'https://unlimited.surf/v1/setup',
    popularModels: [
      { id: 'gateway-claude-opus-4-8', name: 'Claude Opus 4.8', tier: 'flagship' },
      { id: 'gateway-claude-opus-4-7', name: 'Claude Opus 4.7', tier: 'flagship' },
      { id: 'gateway-gpt-5', name: 'GPT-5', tier: 'flagship' },
      { id: 'gateway-google-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'flagship' },
      { id: 'gateway-gemini-3-pro', name: 'Gemini 3 Pro', tier: 'flagship' },
      { id: 'gateway-deepseek-v4-pro', name: 'DeepSeek V4 Pro', tier: 'flagship' },
      { id: 'gateway-deepseek-r1', name: 'DeepSeek R1', tier: 'reasoning' },
      { id: 'gateway-grok-4', name: 'Grok 4', tier: 'flagship' },
      { id: 'gateway-qwen-3-max', name: 'Qwen 3 Max', tier: 'flagship' },
      { id: 'gateway-llama-3-3-70b-versatile', name: 'Llama 3.3 70B', tier: 'standard' },
    ],
  },
  {
    providerId: 'ollama',
    name: 'Ollama (Local)',
    category: 'local',
    description: 'Run models locally via Ollama. Free, private, offline. Default port 11434.',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:11434',
    docsUrl: 'https://ollama.com',
    popularModels: [
      { id: 'llama3.3:70b', name: 'Llama 3.3 70B', tier: 'local' },
      { id: 'qwen2.5-coder:32b', name: 'Qwen2.5 Coder 32B', tier: 'local' },
      { id: 'deepseek-r1:32b', name: 'DeepSeek R1 32B', tier: 'local' },
      { id: 'mistral:7b', name: 'Mistral 7B', tier: 'local' },
    ],
  },
  {
    providerId: 'lmstudio',
    name: 'LM Studio (Local)',
    category: 'local',
    description: 'Run models locally via LM Studio OpenAI-compatible server. Default port 1234.',
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    docsUrl: 'https://lmstudio.ai',
    popularModels: [],
  },
  {
    providerId: 'openai',
    name: 'OpenAI',
    category: 'paid',
    description: 'Official OpenAI API. GPT-4o, GPT-5, o3, o4-mini. Requires API key.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    signupUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://platform.openai.com/docs',
    popularModels: [
      { id: 'gpt-4o', name: 'GPT-4o', tier: 'standard' },
      { id: 'gpt-4o-mini', name: 'GPT-4o mini', tier: 'fast' },
      { id: 'o3-mini', name: 'o3-mini', tier: 'reasoning' },
    ],
  },
  {
    providerId: 'anthropic',
    name: 'Anthropic (Claude)',
    category: 'paid',
    description: 'Official Anthropic API. Claude Opus, Sonnet, Haiku. Requires API key.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.anthropic.com',
    signupUrl: 'https://console.anthropic.com/settings/keys',
    docsUrl: 'https://docs.anthropic.com',
    popularModels: [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', tier: 'flagship' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', tier: 'standard' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'fast' },
    ],
  },
  {
    providerId: 'gemini',
    name: 'Google Gemini',
    category: 'paid',
    description: 'Official Google Gemini API. Gemini 2.5 Pro/Flash. Requires API key.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    signupUrl: 'https://aistudio.google.com/app/apikey',
    docsUrl: 'https://ai.google.dev/docs',
    popularModels: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'flagship' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'fast' },
    ],
  },
  {
    providerId: 'nvidia',
    name: 'NVIDIA NIM',
    category: 'paid',
    description: 'NVIDIA build catalog. Llama, Mistral, Qwen via OpenAI-compatible endpoint.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://integrate.api.nvidia.com/v1',
    signupUrl: 'https://build.nvidia.com',
    docsUrl: 'https://docs.api.nvidia.com',
    popularModels: [
      { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', tier: 'standard' },
      { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B', tier: 'fast' },
    ],
  },
  {
    providerId: 'deepseek',
    name: 'DeepSeek',
    category: 'paid',
    description: 'Official DeepSeek API. DeepSeek V3, R1. Cheap reasoning models.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    signupUrl: 'https://platform.deepseek.com/api_keys',
    docsUrl: 'https://api-docs.deepseek.com',
    popularModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3', tier: 'standard' },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1', tier: 'reasoning' },
    ],
  },
  {
    providerId: 'groq',
    name: 'Groq',
    category: 'paid',
    description: 'Ultra-fast inference for Llama, Mixtral, etc. Free tier available.',
    requiresApiKey: true,
    requiresBaseUrl: false,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    signupUrl: 'https://console.groq.com/keys',
    docsUrl: 'https://console.groq.com/docs',
    popularModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', tier: 'standard' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', tier: 'fast' },
    ],
  },
  {
    providerId: 'openai-compat',
    name: 'Custom (OpenAI-compatible)',
    category: 'custom',
    description: 'Any OpenAI-compatible endpoint (vLLM, llama.cpp, LocalAI, OpenRouter, Together, etc.).',
    requiresApiKey: false,
    requiresBaseUrl: true,
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    popularModels: [],
  },
  {
    providerId: 'anthropic-compat',
    name: 'Custom (Anthropic-compatible)',
    category: 'custom',
    description: 'Any Anthropic-compatible endpoint (Bedrock proxy, gateway, etc.).',
    requiresApiKey: false,
    requiresBaseUrl: true,
    docsUrl: 'https://docs.anthropic.com/en/api/messages',
    popularModels: [],
  },
];
