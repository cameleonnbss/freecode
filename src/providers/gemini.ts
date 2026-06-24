/**
 * FreeCode — Google Gemini provider.
 *
 * Uses POST /v1beta/models/{model}:streamGenerateContent
 * with SSE-style streaming (alt=sse).
 */
import type { Provider, ChatRequest, StreamEvent, ModelInfo } from './types.js';

const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GeminiProvider implements Provider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly category = 'paid' as const;
  readonly requiresApiKey = true;
  readonly authHeader = 'none' as const;

  private baseUrl: string;
  private apiKey?: string;

  constructor(cfg?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = (cfg?.baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
    this.apiKey = cfg?.apiKey;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) {
      return [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', tier: 'flagship' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', tier: 'fast' },
      ];
    }
    try {
      const res = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string; displayName?: string }> };
      return (data.models ?? []).map((m) => ({
        id: m.name.replace(/^models\//, ''),
        name: m.displayName ?? m.name,
      }));
    } catch {
      return [];
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    if (!this.apiKey) {
      yield { type: 'done', reason: 'error', error: 'Gemini API key missing. Run `freecode config`.' };
      return;
    }
    const model = req.model.replace(/^models\//, '');
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    const body = {
      contents: req.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
        })),
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      generationConfig: {
        temperature: req.temperature ?? 0.7,
        ...(req.maxTokens ? { maxOutputTokens: req.maxTokens } : {}),
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          const parts = frame?.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) {
              if (typeof p.text === 'string' && p.text.length > 0) {
                yield { type: 'text', delta: p.text };
              }
            }
          }
          if (frame?.candidates?.[0]?.finishReason) {
            yield { type: 'done', reason: 'stop' };
            return;
          }
          if (frame?.error) {
            yield { type: 'done', reason: 'error', error: String(frame.error.message ?? frame.error) };
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
