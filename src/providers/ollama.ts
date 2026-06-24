/**
 * FreeCode — Ollama local provider.
 *
 * Uses POST /api/chat with SSE-style NDJSON streaming.
 * Default base: http://localhost:11434
 */
import type { Provider, ChatRequest, StreamEvent, ModelInfo } from './types.js';

const DEFAULT_BASE = 'http://localhost:11434';

export class OllamaProvider implements Provider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly category = 'local' as const;
  readonly requiresApiKey = false;

  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl ?? DEFAULT_BASE).replace(/\/+$/, '');
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models?: Array<{ name: string; details?: { parameter_size?: string } }> };
      return (data.models ?? []).map((m) => ({
        id: m.name,
        name: m.name,
        tier: 'local' as const,
      }));
    } catch {
      return [];
    }
  }

  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    const url = `${this.baseUrl}/api/chat`;
    const body = {
      model: req.model,
      messages: [
        ...(req.system ? [{ role: 'system', content: req.system }] : []),
        ...req.messages.map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      ],
      stream: true,
      options: {
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
      },
    };

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: req.signal,
      });
    } catch (e) {
      yield {
        type: 'done',
        reason: 'error',
        error: `Cannot reach Ollama at ${this.baseUrl}. Is it running? (ollama serve)`,
      };
      return;
    }

    if (!res.ok || !res.body) {
      const txt = await res.text().catch(() => '');
      yield { type: 'done', reason: 'error', error: `HTTP ${res.status} ${txt.slice(0, 200)}` };
      return;
    }

    // Ollama streams NDJSON (one JSON object per line).
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
          if (!line) continue;
          let frame: any;
          try {
            frame = JSON.parse(line);
          } catch {
            continue;
          }
          const t = frame?.message?.content;
          if (typeof t === 'string' && t.length > 0) yield { type: 'text', delta: t };
          if (frame.done === true) {
            yield { type: 'done', reason: 'stop' };
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
