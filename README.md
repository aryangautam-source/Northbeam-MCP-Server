# northbeam-mcp

Local **stdio** Model Context Protocol (MCP) server that exposes Northbeam marketing analytics as tools. No HTTP, no SSE, no hosted deployment — Claude Desktop (or the MCP Inspector) spawns this as a local Node process and talks JSON-RPC over stdin/stdout.

## Prerequisites

- Node.js 18+
- Northbeam API key and Data Client ID
- Git

## Install locally (everyone starts here)

```bash
git clone https://github.com/aryangautam-source/Northbeam-MCP-Server.git
cd Northbeam-MCP-Server
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```
NORTHBEAM_API_KEY=your_northbeam_api_key_here
NORTHBEAM_CLIENT_ID=your_northbeam_client_id_here
NORTHBEAM_BRAND=your_brand_name_here
```

Resolve the absolute path to the entry file (you will paste this into client configs):

```bash
# macOS / Linux
echo "$(pwd)/src/index.js"
```

The server fails immediately on startup (clear stderr message) if `NORTHBEAM_API_KEY` or `NORTHBEAM_CLIENT_ID` is missing.

---

## Connect in Claude Desktop (local stdio)

Claude Desktop can spawn this server as a local subprocess. That is the intended production path for this repo.

1. Finish **Install locally** above.
2. Open Claude Desktop → **Settings** → **Developer** → **Edit Config**  
   (or edit the file directly):
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. Add (or replace) the `northbeam` entry under `mcpServers`. Use your real absolute path:

```json
{
  "mcpServers": {
    "northbeam": {
      "command": "node",
      "args": [
        "/ABSOLUTE/PATH/TO/Northbeam-MCP-Server/src/index.js"
      ]
    }
  }
}
```

Example on this machine:

```json
{
  "mcpServers": {
    "northbeam": {
      "command": "node",
      "args": [
        "/Users/aryan/Northbeam-MCP-Server/src/index.js"
      ]
    }
  }
}
```

4. **Fully quit and reopen** Claude Desktop (not just close the window).
5. Start a new chat and confirm the `northbeam` tools appear (e.g. `list_metrics`).

Credentials are loaded from the package `.env` via path resolution relative to `src/index.js`, so Claude’s launch working directory does not matter. Do **not** put API keys in `claude_desktop_config.json`.

### Troubleshoot Claude

- Tools missing → confirm the path exists (`ls` the `args` path) and Node is on your PATH (`which node`).
- Server crashes on start → check Claude MCP logs; missing env vars print to stderr.
- Never add `console.log` to this server — it breaks the JSON-RPC stdio channel.

---

## Connect in Manus

**Important:** Manus Custom MCP expects a **public HTTPS** MCP endpoint. This repository is **stdio-only** by design (no HTTP/SSE transport), so Manus cloud **cannot** attach directly to `localhost` or spawn `node src/index.js` the way Claude Desktop does.

### What to do instead

| Goal | Use |
|------|-----|
| Query Northbeam locally on your machine | **Claude Desktop** (stdio, steps above) |
| Verify the server / tools before wiring a client | **MCP Inspector** (below) |
| Use Manus with Northbeam | Manus needs a separately hosted Streamable HTTP MCP URL — **not included in this repo** |

### If you still want Northbeam available while working in Manus

1. Keep this server running for local Claude / Inspector use as documented above.
2. In Manus: **Settings → Integrations → Custom MCP Servers → Add Server**.
3. Manus will ask for a **Server URL** (HTTPS). Paste only a URL that Manus’s cloud can reach.
4. Optionally add an Authorization header if that remote server requires one.
5. Click **Test Connection**, then **Save**.

Do **not** paste `http://localhost:...` into Manus — it will fail verification because Manus cannot reach your laptop.

---

## Testing with MCP Inspector

From the repo root (after `npm install` and `.env` setup):

```bash
npx @modelcontextprotocol/inspector node src/index.js
```

Or:

```bash
npm run inspect
```

Open the Inspector UI, connect, and try `list_metrics`.

---

## Available tools

| Tool | Params | Description |
|------|--------|-------------|
| `list_metrics` | _(none)_ | All available Northbeam metric IDs/labels |
| `list_dimensions` | _(none)_ | All available dimension/breakdown IDs/labels |
| `get_metric` | `metric_name`, `start_date`, `end_date`, `attribution_model` | Single-metric export for a date range |
| `get_channel_performance` | `start_date`, `end_date`, `attribution_model`, optional `channel` | Platform/channel performance |
| `get_cohort_analysis` | `start_date`, `end_date`, `cohort_dimension` | Breakdown by a cohort dimension key |
| `get_attribution` | `model`, `start_date`, `end_date`, `metrics` | Attribution-broken-down metrics |

`attribution_model` / friendly `model` values:

| Value | Northbeam API id |
|-------|------------------|
| `clicks_only` | `northbeam_custom` |
| `first_touch` | `first_touch` |
| `last_touch` | `last_touch` |

Dates must be `YYYY-MM-DD`. Invalid or missing params return an MCP tool error (`isError: true`), not a process crash.

## Northbeam API behavior (exact)

| Step | Method | URL |
|------|--------|-----|
| Create export | `POST` | `https://api.northbeam.io/v1/exports/data-export` |
| Poll result | `GET` | `https://api.northbeam.io/v1/exports/data-export/result/{export_id}` |

Auth headers on every request:

- `Authorization: Basic {NORTHBEAM_API_KEY}`
- `Data-Client-ID: {NORTHBEAM_CLIENT_ID}`

Polling: every **2.5s** until `status === "SUCCESS"`, hard timeout **60s** (throws a clear timeout error). On success, `result[0]` is a CSV download URL; the client downloads and parses it to JSON rows for the tool response.

List tools use:

- Metrics: `GET /v1/exports/metrics`
- Dimensions: `GET /v1/exports/breakdowns`

Fixed-period exports send:

```json
{
  "period_type": "FIXED",
  "period_options": {
    "period_starting_at": "YYYY-MM-DDT00:00:00Z",
    "period_ending_at": "YYYY-MM-DDT23:59:59Z"
  }
}
```

## Development

```bash
npm run dev    # node --watch src/index.js
npm start      # node src/index.js
```

## Project layout

```
src/
  index.js              # stdio MCP entry (dotenv first; no console.log)
  northbeamClient.js    # auth, export create, poll, CSV parse
  tools/                # one file per tool (schema + handler)
```

## Important constraints

1. **Never write to stdout** except the MCP SDK transport — use `console.error` for logs. Stray `console.log` corrupts JSON-RPC.
2. Credentials are read **at call time**, not at module import time.
3. No absolute machine paths in code; `.env` is resolved via `import.meta.url`.
4. `@modelcontextprotocol/sdk` is **pinned** to `1.29.0` (not a floating range).
