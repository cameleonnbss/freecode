# FreeCode

<div align="center">

```
    dMMMMMP dMMMMb  dMMMMMP dMMMMMP        .aMMMb  .aMMMb  dMMMMb  dMMMMMP 
   dMP     dMP.dMP dMP     dMP            dMP"VMP dMP"dMP dMP VMP dMP      
  dMMMP   dMMMMK" dMMMP   dMMMP          dMP     dMP dMP dMP dMP dMMMP     
 dMP     dMP"AMF dMP     dMP            dMP.aMP dMP.aMP dMP.aMP dMP        
dMP     dMP dMP dMMMMMP dMMMMMP         VMMMP"  VMMMP" dMMMMP" dMMMMMP     
                                                                                                                                                          
```

**Free terminal AI coding assistant — like Claude Code / Gemini CLI / Qwen Code, but free & open source.**

Multi-provider · Bilingual FR/EN · Neon animated UI · Tools (read / write / edit / exec) · History · Memory · Agents

`by cameleonnbss`

</div>

---

## Why FreeCode?

Claude Code, Gemini CLI and Qwen Code are great — but they lock you into one provider and most require a paid API key. **FreeCode** is different:

- **Works out of the box, for free.** Pre-configured with [Unlimited AI](https://unlimited.surf) — an IP-bound gateway that gives you GPT-5, Claude Opus 4.8, Gemini 3 Pro, DeepSeek, Grok, Qwen, Llama… with **no signup, no credit card, no key**.
- **Bring your own provider.** OpenAI, Anthropic, Google Gemini, NVIDIA NIM, DeepSeek, Groq — just paste your key. Or connect a local model via **Ollama** or **LM Studio**.
- **Bring your own endpoint.** Any OpenAI-compatible or Anthropic-compatible server (vLLM, llama.cpp, OpenRouter, Bedrock proxy, LocalAI, …).
- **Your data stays yours.** Config, history and memory live in `~/.freecode/`. Nothing is sent anywhere except the provider you pick.
- **Open source, MIT.** No telemetry, no upsell, no lock-in.

---

## Install

```bash
git clone https://github.com/cameleonnbss/freecode.git
cd freecode
npm install
npm run build
node bin/freecode.js
```

Then symlink `bin/freecode.js` to `/usr/local/bin/freecode` (or `%USERPROFILE%\freecode.cmd` on Windows) if you want `freecode` available everywhere.



### Requirements

- **Node.js ≥ 18** (Node 20 LTS recommended). Get it from <https://nodejs.org>.
- An internet connection (for cloud providers) — or a local Ollama / LM Studio server for fully offline use.


## open

-enter freecode in a powershell

if nothing 

open a new powerhsell and type 

```bash
[Environment]::SetEnvironmentVariable("Path", "$env:Path;$env:USERPROFILE", "User")
```


---

## Quick start

```bash
# 1. Just run it — works immediately with the free Unlimited AI provider
freecode

# 2. Ask anything in one shot
freecode "explain what src/index.ts does"

# 3. Configure a different provider (OpenAI, Claude, Ollama, …)
freecode config

# 4. Pick a model
freecode models

# 5. See your previous chats
freecode history
```

Inside the chat, type `/help` to see all slash commands.


to configuere the unlimited ai api key:

```bash
notepad $env:USERPROFILE\.freecode\config.json
```

---

## Providers

FreeCode supports 11 built-in provider types, grouped in 4 categories:

### 🟢 Free (no key, no card)

| Provider | Base URL | Notes |
|---|---|---|
| **Unlimited AI** | `https://unlimited.surf` | Default. IP-bound key auto-provisioned. GPT-5, Claude Opus 4.8, Gemini 3 Pro, DeepSeek R1, Grok 4, Qwen 3 Max, Llama 3.3 70B, … |

### 💼 Paid (bring your key)

| Provider | Base URL | Popular models |
|---|---|---|
| **OpenAI** | `https://api.openai.com/v1` | GPT-4o, GPT-5, o3, o4-mini |
| **Anthropic** | `https://api.anthropic.com` | Claude Opus 4.5, Sonnet 4.5, Haiku |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | Gemini 2.5 Pro / Flash |
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1` | Llama 3.3 70B, Mistral, Qwen |
| **DeepSeek** | `https://api.deepseek.com/v1` | DeepSeek V3, R1 |
| **Groq** | `https://api.groq.com/openai/v1` | Llama 3.3 70B (ultra-fast) |

### 🏠 Local (free, private, offline)

| Provider | Default URL | Notes |
|---|---|---|
| **Ollama** | `http://localhost:11434` | Run `ollama serve`. Models: `ollama pull llama3.3:70b` |
| **LM Studio** | `http://localhost:1234/v1` | Start the local server in LM Studio → "Developer" tab |

### 🔧 Custom (any compatible endpoint)

| Provider | Wire format | Examples |
|---|---|---|
| **OpenAI-compatible** | `POST /v1/chat/completions` | vLLM, llama.cpp, OpenRouter, Together, LocalAI, llamafile |
| **Anthropic-compatible** | `POST /v1/messages` | Bedrock proxy, gateway, custom Claude-compatible server |

### Adding a provider

```bash
freecode config
# → "Add a provider"
# → pick category (free / paid / local / custom)
# → pick provider type
# → paste your API key (if needed)
# → set base URL (if local / custom)
# → pick a default model
# → "Set as active?" → yes
```

You can also edit `~/.freecode/config.json` directly.

### Using environment variables

```bash
FREECODE_PROVIDER=openai-default \
FREECODE_MODEL=gpt-4o \
freecode
```

---

## Features

### Chat

- **Streaming responses** (SSE) — tokens appear as they're generated.
- **Markdown rendering** — headings, bold/italic, `inline code`, fenced code blocks with syntax-colored borders, bullet/numbered lists, blockquotes, links.
- **Slash commands** — type `/help` inside the chat to see them all.
- **Bilingual FR/EN** — auto-detected from your system, switchable with `/lang`.

### Tools (agent loop)

The model can call tools to actually do things in your workspace:

| Tool | What it does |
|---|---|
| `read_file` | Read a file's content (truncated above 200 KB). |
| `write_file` | Create or overwrite a file. **Asks for confirmation.** |
| `edit_file` | Replace a unique snippet inside a file. **Asks for confirmation.** |
| `list_files` | List a directory (respects `.git` / `node_modules` / `dist` ignores). |
| `search_files` | Recursive grep across the workspace (regex or substring). |
| `run_command` | Run a shell command (`ls`, `git`, `npm test`, …). **Always asks for confirmation.** Dangerously destructive commands (e.g. `rm -rf /`) are refused unless explicitly confirmed twice. |

Tool calls use a portable `<tool_use>{…}</tool_use>` protocol — works with **every** provider, including models that don't natively support function calling.

Toggle auto-confirm for the current session with `/autoconfirm` (off by default — you stay in control).

### History

- Every chat session is persisted to `~/.freecode/history/<project-slug>/<session-id>.json`.
- `freecode history` lists previous sessions for the current directory.
- `freecode chat --resume <id>` (or `/history` inside the chat) resumes any session.
- Sessions are scoped per project (per cwd) so they don't pollute each other.

### Memory

- `/remember key=value` saves a long-term fact (e.g. `/remember preferred_language=TypeScript`).
- Memory is loaded into the system prompt on every turn, so the model remembers across sessions.
- Stored at `~/.freecode/memory/memory.json`.

### Agents (personas)

- Built-in: `default`, `code-reviewer`, `explainer`, `refactorer`, `bug-hunter`.
- `freecode agents` → create your own (name + persona = system instructions).
- Switch on the fly with `/agents` inside the chat.

### Themes

- `neon` (default) — violet→cyan gradient banner, vibrant.
- `minimal` — subdued, for focus.
- `matrix` — green-on-black retro.

Switch with `freecode config` → "Theme", or `/theme` in the chat.

---

## Slash commands (inside the chat)

| Command | Action |
|---|---|
| `/help` | Show all commands. |
| `/exit` | Quit. |
| `/clear` | Wipe the conversation context. |
| `/save` | Save the current session. |
| `/models` | Switch model (lists from active provider). |
| `/provider` | Switch active provider. |
| `/history` | Browse / resume / delete previous sessions. |
| `/theme` | Switch UI theme. |
| `/lang` | Switch UI language (FR/EN/auto). |
| `/agents` | Switch agent persona. |
| `/autoconfirm` | Toggle auto-confirm for tool calls. |
| `/remember key=value` | Save a long-term memory entry. |
| `/tokens` | Show message count. |

---

## CLI reference

```
freecode                          Start an interactive chat (default)
freecode "your question"          One-shot: ask and stream the answer
freecode chat                     Interactive chat
freecode chat --resume <id>       Resume a previous session
freecode config                   Configure providers, model, language, theme
freecode models                   List / pick a model from the active provider
freecode providers                Show supported providers + configured ones
freecode history                  List / resume / delete previous sessions
freecode history --resume <id>    Resume a specific session
freecode agents                   List / create / delete agent personas
freecode --version                Print version
freecode --help                   Show help
```

Flags:

| Flag | Description |
|---|---|
| `-m, --model <id>` | Override the active model for this run. |
| `-p, --provider <id>` | Override the active provider for this run. |
| `-r, --resume <id>` | Resume a session by id. |
| `--no-banner` | Skip the animated banner. |
| `--lang <fr\|en>` | Force a language for this run. |

Environment variables:

| Var | Description |
|---|---|
| `FREECODE_LANG` | `fr` / `en` (overrides config). |
| `FREECODE_PROVIDER` | Provider config id (overrides config). |
| `FREECODE_MODEL` | Model id (overrides config). |
| `HTTP_PROXY` / `HTTPS_PROXY` | Standard proxy env vars. |

---

## File layout

```
~/.freecode/
├── config.json              Providers, model, language, theme
├── freecode.log             Debug log
├── history/
│   └── <project-slug>/      One JSON file per chat session
│       └── s_xxx.json
├── memory/
│   └── memory.json          Long-term memory entries
└── agents/
    └── <agent-id>.json      Custom agent personas
```

---

## Project structure (source)

```
freecode/
├── bin/
│   └── freecode.js          # Shebang entry — boots dist/index.js
├── src/
│   ├── index.ts             # CLI entry — argv parse + command dispatch
│   ├── version.ts
│   ├── core/
│   │   ├── paths.ts         # ~/.freecode/ paths
│   │   ├── config.ts        # Config load/save/migrate
│   │   ├── defaults.ts      # Default config + provider catalogue
│   │   └── logger.ts
│   ├── i18n/                # FR + EN translations, auto-detect
│   ├── ui/
│   │   ├── theme.ts         # Neon palette + gradient helpers
│   │   ├── ascii.ts         # FreeCode wordmark
│   │   ├── banner.ts        # Animated startup banner
│   │   ├── spinner.ts       # Neon spinner
│   │   ├── prompt.ts        # Input / secret / confirm / select / multiselect
│   │   └── markdown.ts      # Terminal markdown renderer
│   ├── providers/
│   │   ├── types.ts         # Provider / ChatRequest / StreamEvent
│   │   ├── registry.ts      # buildProvider(config) → Provider
│   │   ├── unlimitedai.ts   # Free default (Unlimited AI gateway)
│   │   ├── openai-compat.ts # OpenAI / NVIDIA / LM Studio / Groq / DeepSeek / custom
│   │   ├── anthropic.ts     # Claude / Anthropic-compatible
│   │   ├── ollama.ts        # Local
│   │   └── gemini.ts        # Google Gemini
│   ├── tools/
│   │   ├── types.ts         # Tool interface + registry + prompt block
│   │   ├── read-file.ts
│   │   ├── write-file.ts
│   │   ├── edit-file.ts
│   │   ├── list-files.ts
│   │   ├── search-files.ts
│   │   └── run-command.ts
│   ├── agent/
│   │   ├── agent.ts         # Think → act → observe loop
│   │   ├── system-prompt.ts
│   │   └── agents.ts        # Built-in + custom personas
│   ├── chat/
│   │   ├── session.ts       # Interactive REPL
│   │   ├── history.ts       # Persisted sessions
│   │   └── memory.ts        # Long-term memory
│   └── cli/
│       ├── parser.ts        # Hand-rolled argv parser
│       └── commands/        # config / models / providers / history / agents
├── install.sh               # macOS / Linux / WSL installer
├── install.bat              # Windows installer
├── freecode.sh              # Direct launcher (Unix)
├── freecode.bat             # Direct launcher (Windows)
├── package.json
├── tsconfig.json
├── LICENSE
└── README.md
```

---

## Build from source

```bash
git clone https://github.com/cameleonnbss/freecode.git
cd freecode
npm install
npm run build      # tsc → dist/
npm run smoke      # quick smoke test: --version + --help
npm run dev        # run from source via tsx (no build needed)
```

---

## Roadmap

- [ ] Native tool-calling for providers that support it (Anthropic / OpenAI function calling) — currently we use the portable `<tool_use>` protocol that works everywhere.
- [ ] MCP (Model Context Protocol) server support — run filesystem / github / slack MCP servers inside FreeCode.
- [ ] Diff preview before `write_file` / `edit_file`.
- [ ] `freecode serve` — expose FreeCode as an HTTP API.
- [ ] Plugin system for custom tools.
- [ ] Terminal UI mode (Ink / React) with side-by-side diff viewer.

---

## Contributing

PRs welcome! The codebase is intentionally small and readable.

```bash
git clone https://github.com/cameleonnbss/freecode.git
cd freecode
npm install
npm run dev   # iterate with tsx, no build needed
```

Areas that especially need love:

- More providers (Mistral, Cohere, Together, Fireworks, …).
- Better markdown rendering (syntax highlighting inside code blocks).
- Windows-specific tooling (PowerShell integration, better `.bat` ergonomics).
- Tests.

---

## Credits

- Inspired by [Claude Code](https://claude.com/claude-code), [Gemini CLI](https://github.com/google-gemini/gemini-cli), and [Qwen Code](https://github.com/QwenLM/qwen-code) — FreeCode is a fully independent implementation, not a fork.
- Free default provider: [Unlimited AI](https://unlimited.surf).
- ASCII wordmark: hand-drawn for FreeCode.

---

## License

MIT — © 2026 [cameleonnbss](https://github.com/cameleonnbss). See [LICENSE](LICENSE).

FreeCode is free software. No telemetry. No tracking. No upsell. Just code.
