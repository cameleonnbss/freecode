/**
 * FreeCode — Unlimited AI provider (FREE, default).
 *
 * Docs: https://unlimited.surf
 * - GET  /api/key       → IP-bound auth key (no signup, no card)
 * - GET  /api/models    → public model catalog
 * - POST /api/chat      → SSE streaming chat (data: JSON frames)
 * - POST /api/search    → web search with cited sources
 * - POST /v1/messages   → Anthropic-compatible Messages API
 *
 * We use /api/chat for streaming text (works with every model in the
 * catalog: GPT-5, Claude Opus, Gemini, DeepSeek, Grok, Qwen, Llama…)
 * and lazily provision the IP-bound key on first call.
 */
import type { Provider, ChatRequest, StreamEvent, ModelInfo } from './types.js';
import { log } from '../core/logger.js';

const DEFAULT_BASE = 'https://unlimited.surf';

interface UnlimitedConfig {
  baseUrl: string;
  apiKey?: string;
}

export class UnlimitedAIProvider implements Provider {
  readonly id = 'unlimitedai';
  readonly name = 'Unlimited AI (Free)';
  readonly category = 'free' as const;
  readonly requiresApiKey = false;

  private cfg: UnlimitedConfig;
  private cachedKey: string | null = null;

  constructor(cfg?: Partial<UnlimitedConfig>) {
    this.cfg = { baseUrl: cfg?.baseUrl ?? DEFAULT_BASE, apiKey: cfg?.apiKey };
  }

  private async getKey(): Promise<string> {
    if (this.cfg.apiKey && this.cfg.apiKey.length > 0) return this.cfg.apiKey;
    if (this.cachedKey) return this.cachedKey;
    // Lazily provision an IP-bound key.
    const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}/api/key`;
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { key?: string; auth_key?: string };
      const k = data.key ?? data.auth_key ?? '';
      if (!k) throw new Error('No key in response');
      this.cachedKey = k;
      log(`UnlimitedAI: provisioned IP-bound key ${k.slice(0, 8)}…`);
      return k;
    } catch (e) {
      throw new Error(`Failed to fetch Unlimited AI key: ${(e as Error).message}. Visit ${this.cfg.baseUrl} to debug.`);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}/api/models`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string; provider?: string; tier?: string }> };
      return (data.data ?? []).map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        provider: m.provider,
        tier: (m.tier as ModelInfo['tier']) ?? 'standard',
      }));
    } catch {
      return [];
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const key = await this.getKey();
    const url = `${this.cfg.baseUrl.replace(/\/+$/, '')}/api/chat`;

    // Flatten messages into the simple {message, model} format /api/chat expects.
    // We send the system prompt + the last user message; tool results are
    // rendered back into the user turn so the model sees them.
    const body = {
      message: serializeMessages(req.messages, req.system),
      model: req.model,
      effort: 'medium',
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      yield { type: 'done', reason: 'error', error: `HTTP ${res.status} ${txt.slice(0, 200)}` };
      return;
    }

    // Parse SSE: lines starting with "data: " contain JSON.
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let sawDelta = false;
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
          if (!json) continue;
          let frame: Record<string, unknown>;
          try {
            frame = JSON.parse(json);
          } catch {
            continue;
          }
          if (typeof frame.delta === 'string' && frame.delta.length > 0) {
            sawDelta = true;
            yield { type: 'text', delta: frame.delta as string };
          }
          if (frame.finish === true || frame.done === true) {
            yield { type: 'done', reason: 'stop' };
            return;
          }
          if (frame.error) {
            yield { type: 'done', reason: 'error', error: String(frame.error) };
            return;
          }
        }
      }
      if (!sawDelta) {
        yield { type: 'done', reason: 'error', error: 'Empty stream from Unlimited AI.' };
      } else {
        yield { type: 'done', reason: 'stop' };
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
    }
  }
}

/** Serialize the full message list into a single user turn for /api/chat. */
function serializeMessages(messages: ChatRequest['messages'], system?: string): string {
  const parts: string[] = [];
  if (system) parts.push(`[SYSTEM]\n${system}`);
  for (const m of messages) {
    const role = m.role.toUpperCase();
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    parts.push(`[${role}]\n${text}`);
  }
  parts.push('[ASSISTANT]');
  return parts.join('\n\n');
}
