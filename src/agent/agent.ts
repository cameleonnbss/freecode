/**
 * FreeCode — agent loop.
 *
 * Think → act → observe cycle:
 *   1. Send (system + messages) to the active provider.
 *   2. Stream the assistant's visible text to the UI as it arrives.
 *   3. Detect <tool_use>…</tool_use> blocks in the stream.
 *   4. When a block is complete, ABORT the stream, run the tool,
 *      append the tool_result as a new user message, re-enter the loop.
 *   5. Stop when a turn finishes with no tool calls.
 *
 * Aborting on tool call is important: otherwise the model keeps emitting
 * text after </tool_use> without having seen the tool result, which is
 * hallucinated and would confuse the next turn.
 */
import type { Provider, Message, ChatRequest } from '../providers/types.js';
import { getTool, listTools, type ToolContext } from '../tools/index.js';
import { log } from '../core/logger.js';

const TOOL_USE_OPEN = '<tool_use>';
const TOOL_USE_CLOSE = '</tool_use>';

export interface AgentOptions {
  provider: Provider;
  model: string;
  system: string;
  cwd: string;
  toolCtx: ToolContext;
  maxIterations?: number;
  onText: (delta: string) => void;
  onToolStart?: (name: string, input: Record<string, unknown>) => void;
  onToolEnd?: (name: string, ok: boolean, output: string) => void;
  onTurnStart?: () => void;
  signal?: AbortSignal;
}

export interface AgentTurnResult {
  text: string;
  turns: number;
  toolCalls: number;
  error?: string;
}

interface StreamAccumulated {
  visible: string;
  rawAssistant: string;
  toolCall: { name: string; input: Record<string, unknown> } | null;
  error?: string;
}

export async function runAgentTurn(
  messages: Message[],
  userText: string,
  opts: AgentOptions,
): Promise<AgentTurnResult> {
  messages.push({ role: 'user', content: userText });

  const maxIter = opts.maxIterations ?? 12;
  let turns = 0;
  let toolCalls = 0;
  let lastError: string | undefined;
  let finalText = '';

  for (let iter = 0; iter < maxIter; iter++) {
    turns++;
    opts.onTurnStart?.();

    const controller = new AbortController();
    const externalSignal = opts.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    const req: ChatRequest = {
      model: opts.model,
      system: opts.system,
      messages: [...messages],
      signal: controller.signal,
    };

    const acc: StreamAccumulated = { visible: '', rawAssistant: '', toolCall: null };

    try {
      for await (const ev of opts.provider.stream(req)) {
        if (ev.type === 'text') {
          acc.rawAssistant += ev.delta;
          // Re-emit any visible text up to a potential tool_use boundary.
          const emit = drainVisible(acc);
          if (emit) {
            acc.visible += emit;
            opts.onText(emit);
          }
          if (acc.toolCall) {
            // Block complete — abort the stream and break out.
            controller.abort();
            break;
          }
        } else if (ev.type === 'done') {
          if (ev.reason === 'error') acc.error = ev.error;
          break;
        }
      }
    } catch (e) {
      if (!acc.toolCall) {
        acc.error = (e as Error).message;
        log(`Agent stream error: ${acc.error}`);
      }
    }

    // Flush any trailing visible text (post-block, if stream ended naturally).
    const tail = drainVisible(acc);
    if (tail) {
      acc.visible += tail;
      opts.onText(tail);
    }

    if (acc.error && !acc.toolCall) {
      lastError = acc.error;
      opts.onText(`\n[error: ${lastError}]\n`);
      messages.push({ role: 'assistant', content: acc.visible + `\n[error: ${lastError}]` });
      finalText = acc.visible;
      break;
    }

    if (acc.toolCall) {
      const call = acc.toolCall;
      toolCalls++;
      opts.onToolStart?.(call.name, call.input);

      // Append the assistant turn that contains the tool_use block.
      messages.push({ role: 'assistant', content: acc.rawAssistant });

      const tool = getTool(call.name);
      let result;
      if (!tool) {
        result = {
          ok: false,
          output: `Unknown tool: ${call.name}. Available: ${listTools().map((t) => t.name).join(', ')}.`,
        };
      } else {
        try {
          result = await tool.run(call.input, opts.toolCtx);
        } catch (e) {
          result = { ok: false, output: `Tool threw: ${(e as Error).message}` };
        }
      }
      opts.onToolEnd?.(call.name, result.ok, result.output);

      messages.push({
        role: 'user',
        content: `[TOOL_RESULT ${call.name}]\n${result.output}`,
      });

      finalText = acc.visible;
      // Loop again — the model will continue with the tool result.
      continue;
    }

    // No tool call this turn — we're done.
    messages.push({ role: 'assistant', content: acc.visible });
    finalText = acc.visible;
    break;
  }

  return {
    text: finalText,
    turns,
    toolCalls,
    error: lastError,
  };
}

/**
 * Walk the raw assistant buffer, extract any complete tool_use block, and
 * return the visible text that is safe to emit now. Sets acc.toolCall when
 * a complete block has been parsed.
 *
 * State is carried via the `pending` field on the accumulator (kept on the
 * object so repeated calls share state).
 */
function drainVisible(acc: StreamAccumulated): string {
  if (!acc.toolCall && (acc as any)._pending) {
    // Resume inside-block state.
  }
  let buffer = (acc as any)._buf ?? acc.rawAssistant;
  let visible = (acc as any)._vis ?? '';
  let inBlock = (acc as any)._inBlock ?? false;
  let blockBuf = (acc as any)._blockBuf ?? '';

  // We process the buffer from where we left off. Track an offset.
  let offset = (acc as any)._offset ?? 0;
  let emittedThisRound = '';

  while (offset < buffer.length) {
    if (inBlock) {
      const closeIdx = buffer.indexOf(TOOL_USE_CLOSE, offset);
      if (closeIdx >= 0) {
        blockBuf += buffer.slice(offset, closeIdx);
        offset = closeIdx + TOOL_USE_CLOSE.length;
        inBlock = false;
        const call = parseToolUse(blockBuf);
        blockBuf = '';
        if (call) {
          acc.toolCall = call;
          break;
        }
        // Not a valid tool call — emit it as visible text.
        emittedThisRound += TOOL_USE_OPEN + '<<invalid>>' + TOOL_USE_CLOSE;
      } else {
        // Still inside block — accumulate and wait for more.
        blockBuf += buffer.slice(offset);
        offset = buffer.length;
        break;
      }
    } else {
      const openIdx = buffer.indexOf(TOOL_USE_OPEN, offset);
      if (openIdx >= 0) {
        emittedThisRound += buffer.slice(offset, openIdx);
        offset = openIdx + TOOL_USE_OPEN.length;
        inBlock = true;
        blockBuf = '';
      } else {
        // No open marker — but the tail might be a partial marker prefix.
        const safe = safeEmitLength(buffer, offset);
        if (safe > offset) {
          emittedThisRound += buffer.slice(offset, safe);
          offset = safe;
        }
        break;
      }
    }
  }

  (acc as any)._offset = offset;
  (acc as any)._inBlock = inBlock;
  (acc as any)._blockBuf = blockBuf;
  (acc as any)._buf = buffer;

  return emittedThisRound;
}

/** Return the end index up to which it's safe to emit (no partial marker). */
function safeEmitLength(buffer: string, offset: number): number {
  const marker = TOOL_USE_OPEN;
  const remaining = buffer.slice(offset);
  for (let i = Math.min(marker.length - 1, remaining.length); i >= 1; i--) {
    const tail = remaining.slice(remaining.length - i);
    if (marker.startsWith(tail)) {
      return offset + remaining.length - i;
    }
  }
  return offset + remaining.length;
}

function parseToolUse(raw: string): { name: string; input: Record<string, unknown> } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const obj = JSON.parse(trimmed);
    if (typeof obj.name === 'string' && typeof obj.input === 'object' && obj.input !== null) {
      return { name: obj.name, input: obj.input as Record<string, unknown> };
    }
    if (typeof obj.tool === 'string') {
      const input = obj.args ?? obj.parameters ?? obj.input ?? {};
      return { name: obj.tool, input: input as Record<string, unknown> };
    }
    return null;
  } catch {
    return null;
  }
}
