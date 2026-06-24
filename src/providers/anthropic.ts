/**
 * FreeCode — Anthropic-compatible provider (Claude / Bedrock proxy / gateway).
 *
 * Uses POST /v1/messages with SSE streaming.
 * Auth via x-api-key header (standard Anthropic).
 */
import type { Provider, ChatRequest, StreamEvent, ModelInfo } from './types.js';

const DEFAULT_BASE = 'https://api.anthropic.com';

interface AnthropicConfig {
  baseUrl: string;
  apiKey?: string;
}

export class AnthropicProvider implements Provider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic (Claude)';
  readonly category = 'paid' as const;
  readonly requiresApiKey = true;
  readonly authHeader = 'x-api-key' as const;

  private cfg: AnthropicConfig;

  constructor(cfg?: Partial<AnthropicConfig>) {
    this.cfg = {
      baseUrl: (cfg?.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, ''),
      apiKey: cfg?.apiKey,
    };
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.cfg.apiKey ?? '',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic has no public list-models endpoint — return a static catalog.
    return [
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', tier: 'flagship' },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', tier: 'standard' },
      { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', tier: 'standard' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', tier: 'fast' },
    ];
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const url = `${this.cfg.baseUrl}/v1/messages`;
    const body = {
      model: req.model,
      max_tokens: req.maxTokens ?? 4096,
      system: req.system,
      messages: buildAnthropicMessages(req.messages),
      stream: true,
      ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
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
          if (!json) continue;
          let frame: any;
          try {
            frame = JSON.parse(json);
          } catch {
            continue;
          }
          if (frame.type === 'content_block_delta' && frame.delta?.type === 'text_delta') {
            const t = frame.delta.text;
            if (typeof t === 'string' && t.length > 0) yield { type: 'text', delta: t };
          }
          if (frame.type === 'message_stop') {
            yield { type: 'done', reason: 'stop' };
            return;
          }
          if (frame.type === 'error') {
            yield { type: 'done', reason: 'error', error: String(frame.error?.message ?? frame.error) };
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

function buildAnthropicMessages(messages: ChatRequest['messages']) {
  // Anthropic expects alternating user/assistant turns; merge consecutive same-role.
  const out: Array<{ role: string; content: string }> = [];
  for (const m of messages) {
    if (m.role === 'system') continue; // system goes in its own field
    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
    const last = out[out.length - 1];
    if (last && last.role === m.role) {
      last.content += '\n\n' + content;
    } else {
      out.push({ role: m.role, content });
    }
  }
  return out;
}
