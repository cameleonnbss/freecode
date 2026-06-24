/**
 * FreeCode — provider registry.
 *
 * Builds a Provider instance from a ProviderConfig (which is what the user
 * has stored in ~/.freecode/config.json). This is the single entry point
 * the rest of the app uses to get a live Provider.
 */
import type { Provider, ProviderConfig } from './types.js';
import { UnlimitedAIProvider } from './unlimitedai.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { AnthropicProvider } from './anthropic.js';
import { OllamaProvider } from './ollama.js';
import { GeminiProvider } from './gemini.js';
import { PROVIDER_CATALOG } from '../core/defaults.js';

/** Build a Provider from a stored ProviderConfig. */
export function buildProvider(cfg: ProviderConfig): Provider {
  switch (cfg.providerId) {
    case 'unlimitedai':
      return new UnlimitedAIProvider({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    case 'ollama':
      return new OllamaProvider(cfg.baseUrl);
    case 'lmstudio':
      // LM Studio exposes an OpenAI-compatible /v1 endpoint, no key needed.
      return new OpenAICompatProvider({
        name: 'LM Studio (Local)',
        category: 'local',
        baseUrl: cfg.baseUrl ?? 'http://localhost:1234/v1',
        apiKey: cfg.apiKey || 'lm-studio',
        requiresApiKey: false,
        authHeader: 'none',
      });
    case 'openai':
      return new OpenAICompatProvider({
        name: 'OpenAI',
        category: 'paid',
        baseUrl: cfg.baseUrl ?? 'https://api.openai.com/v1',
        apiKey: cfg.apiKey,
        requiresApiKey: true,
        authHeader: 'bearer',
      });
    case 'anthropic':
      return new AnthropicProvider({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    case 'gemini':
      return new GeminiProvider({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    case 'nvidia':
      return new OpenAICompatProvider({
        name: 'NVIDIA NIM',
        category: 'paid',
        baseUrl: cfg.baseUrl ?? 'https://integrate.api.nvidia.com/v1',
        apiKey: cfg.apiKey,
        requiresApiKey: true,
        authHeader: 'bearer',
      });
    case 'deepseek':
      return new OpenAICompatProvider({
        name: 'DeepSeek',
        category: 'paid',
        baseUrl: cfg.baseUrl ?? 'https://api.deepseek.com/v1',
        apiKey: cfg.apiKey,
        requiresApiKey: true,
        authHeader: 'bearer',
      });
    case 'groq':
      return new OpenAICompatProvider({
        name: 'Groq',
        category: 'paid',
        baseUrl: cfg.baseUrl ?? 'https://api.groq.com/openai/v1',
        apiKey: cfg.apiKey,
        requiresApiKey: true,
        authHeader: 'bearer',
      });
    case 'openai-compat':
      return new OpenAICompatProvider({
        name: cfg.label || 'Custom (OpenAI-compat)',
        category: 'custom',
        baseUrl: cfg.baseUrl ?? '',
        apiKey: cfg.apiKey,
        requiresApiKey: !!cfg.apiKey,
        authHeader: 'bearer',
      });
    case 'anthropic-compat':
      return new AnthropicProvider({ baseUrl: cfg.baseUrl, apiKey: cfg.apiKey });
    default:
      // Unknown providerId — fall back to OpenAI-compatible with stored baseUrl.
      return new OpenAICompatProvider({
        name: cfg.label || cfg.providerId,
        category: 'custom',
        baseUrl: cfg.baseUrl ?? '',
        apiKey: cfg.apiKey,
        requiresApiKey: !!cfg.apiKey,
        authHeader: 'bearer',
      });
  }
}

/** Find the catalog entry for a providerId (for the picker UI). */
export function catalogEntry(providerId: string) {
  return PROVIDER_CATALOG.find((p) => p.providerId === providerId);
}
