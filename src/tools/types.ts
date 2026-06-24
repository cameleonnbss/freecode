/**
 * FreeCode — tool interface.
 *
 * A Tool is something the model can call: read a file, write a file,
 * run a command, etc. The agent loop parses <tool_use> blocks from the
 * model's text output, looks up the tool by name, executes it, and feeds
 * the result back as a tool_result message.
 */
export interface ToolContext {
  cwd: string;
  /** Whether the user pre-approved all tool calls (auto-confirm). */
  autoConfirm: boolean;
  /** Callback to ask the user for confirmation (returns false to deny). */
  confirm?: (toolName: string, input: Record<string, unknown>) => Promise<boolean>;
  /** Sink for status messages printed during tool execution. */
  onStatus?: (msg: string) => void;
}

export interface ToolResult {
  /** Whether the tool succeeded. */
  ok: boolean;
  /** Human-readable result string (sent back to the model). */
  output: string;
  /** Optional metadata for the UI. */
  meta?: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  /** JSON schema for the tool's input. */
  inputSchema: Record<string, unknown>;
  /** Execute the tool. Must be side-effectful only when allowed. */
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

/** All registered tools. */
export const TOOLS: Record<string, Tool> = {};

export function registerTool(tool: Tool): void {
  TOOLS[tool.name] = tool;
}

export function getTool(name: string): Tool | undefined {
  return TOOLS[name];
}

export function listTools(): Tool[] {
  return Object.values(TOOLS);
}

/** Serialize the tool catalog as a description block for the system prompt. */
export function toolsPromptBlock(): string {
  const lines: string[] = ['You have access to the following tools. To call one, output a fenced block like:\n\n<tool_use>\n{"name":"read_file","input":{"path":"src/index.ts"}}\n</tool_use>\n'];
  for (const t of listTools()) {
    lines.push(`- ${t.name}: ${t.description}`);
    const props = (t.inputSchema.properties ?? {}) as Record<string, { type?: string; description?: string }>;
    const required = (t.inputSchema.required ?? []) as string[];
    const argLines = Object.entries(props).map(
      ([k, v]) => `    - ${k} (${v.type ?? 'any'}${required.includes(k) ? ', required' : ''}): ${v.description ?? ''}`,
    );
    if (argLines.length > 0) lines.push('  Args:', ...argLines);
  }
  return lines.join('\n');
}
