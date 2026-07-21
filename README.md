# northbeam-mcp

Local **stdio** Model Context Protocol (MCP) server that exposes Northbeam marketing analytics as tools. No HTTP, no SSE, no hosted deployment — Claude Desktop (or the MCP Inspector) spawns this as a local Node process and talks JSON-RPC over stdin/stdout.

## Prerequisites

- Node.js 18+
- Northbeam API key and Data Client ID

## Setup

```bash
git clone <this-repo>
cd Northbeam-MCP-Server
npm install
cp .env.example .env
```

Edit `.env`:

```
NORTHBEAM_API_KEY=your_northbeam_api_key_here
NORTHBEAM_CLIENT_ID=your_northbeam_client_id_here
NORTHBEAM_BRAND=your_brand_name_here
```

The server fails immediately on startup (clear stderr message) if `NORTHBEAM_API_KEY` or `NORTHBEAM_CLIENT_ID` is missing.

## Claude Desktop config (stdio)

Add to `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "northbeam": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/Northbeam-MCP-Server/src/index.js"]
    }
  }
}
```

Replace `/ABSOLUTE/PATH/TO/Northbeam-MCP-Server` with the real path on your machine. Restart Claude Desktop after saving.

Credentials are loaded from the package `.env` via path resolution relative to `src/index.js`, so the launch working directory does not matter.

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node src/index.js
```

Or:

```bash
npm run inspect
```

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
