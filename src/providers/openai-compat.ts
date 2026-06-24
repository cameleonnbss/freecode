/**
 * FreeCode — OpenAI-compatible provider.
 *
 * One adapter covers: OpenAI, NVIDIA NIM, LM Studio, Groq, DeepSeek,
 * OpenRouter, Together, vLLM, llama.cpp server, LocalAI, and any custom
 * endpoint that implements POST /v1/chat/completions with SSE streaming.
 *
 * Tool calls are emitted as text deltas (the agent parses them), so this
 * works with models that don't natively support function calling.
 */
import type { Provider, ChatRequest, StreamEvent, ModelInfo } from './types.js';
import { log } from '../core/logger.js';

const DEFAULT_BASE = 'https://api.openai.com/v1';

interface OpenAICompatConfig {
  baseUrl: string;
  apiKey?: string;
  authHeader: 'bearer' | 'x-api-key' | 'none';
}

export class OpenAICompatProvider implements Provider {
  readonly id = 'openai-compat';
  readonly name: string;
  readonly category: 'paid' | 'local' | 'custom';
  readonly requiresApiKey: boolean;
  readonly authHeader: 'bearer' | 'x-api-key' | 'none';

  private cfg: OpenAICompatConfig;

  constructor(opts: {
    name?: string;
    category?: 'paid' | 'local' | 'custom';
    baseUrl?: string;
    apiKey?: string;
    requiresApiKey?: boolean;
    authHeader?: 'bearer' | 'x-api-key' | 'none';
  }) {
    this.cfg = {
      baseUrl: (opts.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, ''),
      apiKey: opts.apiKey,
      authHeader: opts.authHeader ?? 'bearer',
    };
    this.name = opts.name ?? 'OpenAI-compatible';
    this.category = opts.category ?? 'custom';
    this.requiresApiKey = opts.requiresApiKey ?? !!opts.apiKey;
    this.authHeader = this.cfg.authHeader;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.cfg.authHeader === 'bearer' && this.cfg.apiKey) {
      h.Authorization = `Bearer ${this.cfg.apiKey}`;
    } else if (this.cfg.authHeader === 'x-api-key' && this.cfg.apiKey) {
      h['x-api-key'] = this.cfg.apiKey;
    }
    return h;
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.cfg.baseUrl}/models`, { headers: this.headers() });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }));
    } catch {
      return [];
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const url = `${this.cfg.baseUrl}/chat/completions`;
    const body = {
      model: req.model,
      messages: buildOpenAIMessages(req),
      stream: true,
      temperature: req.temperature ?? 0.7,
      ...(req.maxTokens ? { max_tokens: req.maxTokens } : {}),
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      yield { type: 'done', reason: 'error', error: `HTTP ${res.status} ${txt.slice(0, 300)}` };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line || !line.startsWith('data:')) continue;
          const json = line.slice(5).trim();
          if (json === '[DONE]') {
            yield { type: 'done', reason: 'stop' };
            return;
          }
          let frame: any;
          try {
            frame = JSON.parse(json);
          } catch {
            continue;
          }
          const delta = frame?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            yield { type: 'text', delta };
          }
          const finish = frame?.choices?.[0]?.finish_reason;
          if (finish === 'stop' || finish === 'length') {
            yield { type: 'done', reason: finish === 'length' ? 'length' : 'stop' };
            return;
          }
        }
      }
      yield { type: 'done', reason: 'stop' };
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
    }
  }
}

function buildOpenAIMessages(req: ChatRequest): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = [];
  if (req.system) out.push({ role: 'system', content: req.system });
  for (const m of req.messages) {
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    out.push({ role: m.role, content });
  }
  return out;
}
