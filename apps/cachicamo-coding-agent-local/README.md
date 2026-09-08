# Cachicamo Coding Agent Local

Local-first coding agent desktop app for the Chiwire monorepo.

**Cachicamo** is the Venezuelan name for armadillo — the app icon is a flat toon
cachicamo in `resources/icon.png` / `resources/icon.svg`.

Stack: **Electron**, **React**, **@chiwire/ui** (Internal / Valenstonic),
**Ollama** (local or cloud), with **rules**, **skills**, **MCP tools**,
**subagents**, and a **localhost HTTP API** for n8n / external callers.

Appearance defaults to **Internal + dark**. Change via **View → Archetype / Theme**;
the choice is saved in app settings.

## Run

```sh
npm install
npm run dev:cachicamo-coding-agent-local
```

## Windows executable

Uses [electron-builder](https://www.electron.build/). Prefer building on **native Windows**
(not WSL) so NSIS and code signing tooling work cleanly.

```sh
# from repo root (Windows PowerShell / cmd with Node 22+)
npm install
npm run build:cachicamo-coding-agent-local:win
```

Or from this app folder:

```sh
npm run build:win
```

Outputs land in `apps/cachicamo-coding-agent-local/release/`:

| Artifact | What it is |
|----------|------------|
| `Cachicamo Coding Agent Local-0.1.0-setup.exe` | NSIS installer |
| `Cachicamo Coding Agent Local-0.1.0-portable.exe` | Portable (no install) |

Other useful targets:

```sh
npm run build:unpack   # unpacked dir only (quick smoke test)
npm run build:linux    # Linux packages (when on Linux)
```

**WSL note:** cross-building `--win` from Linux/WSL often fails or needs Wine.
Clone/open the repo under Windows (`C:\...`) and run the commands there, or use a
`windows-latest` CI job.

## Workspace layout

In the opened workspace folder:

```text
.cachicamo/
  rules/                 # always-on markdown rules
    style.md
  skills/
    commit/
      SKILL.md           # on-demand skill (YAML frontmatter + body)
AGENTS.md                # also loaded as a rule when present
```

Copy starters from `templates/` in this app.

## Features

| Feature | Behavior |
|---------|----------|
| Rules | Injected into the system prompt from `AGENTS.md` + `.cachicamo/rules/` |
| Skills | Catalog in prompt; agent calls `list_skills` / `load_skill` |
| MCP | Streamable HTTP MCP clients; tools appear as `mcp__<server>__<tool>` |
| Subagents | `spawn_subagent` with `explore` (read-only), `shell`, or `general` |
| WSL (Windows) | `run_command` via `wsl.exe`; File → Open WSL Folder; auto-on for UNC WSL paths |
| External API | `127.0.0.1:<port>` for n8n HTTP Request nodes |

## WSL (Windows build)

When Cachicamo runs as a **Windows** app, Agent settings can send `run_command` through
WSL instead of host bash:

1. Open a folder under `\\wsl$\<distro>\...` (File → **Open WSL Folder…**), or toggle
   **WSL commands** and pick a distro.
2. Opening a `\\wsl$\` or `\\wsl.localhost\` path turns WSL on and sets that distro.
3. File tools still use the Windows workspace path. Commands run as
   `wsl.exe -d <distro> -- bash -lc` with cwd mapped (`C:\foo` → `/mnt/c/foo`,
   `\\wsl$\Ubuntu\home\you` → `/home/you`).

If you are already running the Linux/WSLg build inside WSL, commands already use bash
there — the bridge is for the Windows executable.

## External API (n8n)

Enabled by default on `http://127.0.0.1:3847` (toggle in the sidebar). Auth is a
Bearer token shown in settings.

### Health

```sh
curl http://127.0.0.1:3847/health
```

### Capabilities

```sh
curl http://127.0.0.1:3847/v1/capabilities \
  -H "Authorization: Bearer $CACHICAMO_TOKEN"
```

### Run agent (JSON — best for n8n)

```sh
curl -X POST http://127.0.0.1:3847/v1/agent/run \
  -H "Authorization: Bearer $CACHICAMO_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "message": "Summarize the top-level package.json scripts",
    "workspacePath": "/absolute/path/to/repo"
  }'
```

Response:

```json
{
  "ok": true,
  "reply": "...",
  "events": []
}
```

### Run agent (SSE stream)

Same endpoint with `"stream": true`. Events are `text`, `tool_start`, `tool_end`,
`subagent_start`, `subagent_end`, `error`, `done`.

### n8n sketch

1. Keep Cachicamo running with External API enabled.
2. HTTP Request node → `POST http://127.0.0.1:3847/v1/agent/run`
3. Header `Authorization: Bearer <token>`
4. JSON body `{ "message": "{{$json.prompt}}", "workspacePath": "/path" }`

## MCP example

With `@chiwire/mcps` running locally:

1. Sidebar → Add MCP → name `trello`, URL `http://localhost:3000/trello`
2. Enable it; tools become available on the next agent run

Optional headers / bearer token can be added later in the settings JSON if needed.

## Ollama

- Local: `http://localhost:11434`
- Cloud: `https://ollama.com` + API key
- Prefer tool-capable models (`qwen2.5-coder`, `llama3.1`, cloud coding models)
