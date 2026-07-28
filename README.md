# northbeam-mcp

Local **stdio** Model Context Protocol (MCP) server that exposes Northbeam marketing analytics as tools. No HTTP, no SSE, no hosted deployment — Claude Desktop, Manus (STDIO transport), or the MCP Inspector spawn this as a local Node process and talk JSON-RPC over stdin/stdout.

## Prerequisites

You need three things before anything else: **Node.js**, **Git**, and your **Northbeam credentials**. If you already have them, skip ahead to [Install locally](#install-locally-everyone-starts-here).

### Node.js (version 18 or higher)

Node.js is the program that actually runs this server. Check if you already have it:

```bash
node --version
```

If you see `v18.x.x` or higher, you're good. If you get "command not found" or a version below 18, install it:

- **macOS:** Download the installer from [nodejs.org](https://nodejs.org) and run it. Pick the **LTS** version.
- **Windows:** Same — go to [nodejs.org](https://nodejs.org), download the **LTS** installer, and run it.
- **Linux:** Run `sudo apt install nodejs npm` (Ubuntu/Debian) or follow the guide at [nodejs.org](https://nodejs.org).

After installing, close and reopen your terminal, then run `node --version` again to confirm.

### Git

Git is used to download this repo. Check if you have it:

```bash
git --version
```

If you get "command not found":

- **macOS:** Run `xcode-select --install` in your terminal.
- **Windows:** Download from [git-scm.com](https://git-scm.com) and run the installer.
- **Linux:** Run `sudo apt install git`.

### Northbeam API key and Data Client ID

You need these from your Northbeam account. If you don't have them, ask your Northbeam account manager or check your Northbeam dashboard under **Settings → API**.

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
echo "$(pwd)/src/index.js"
```

If `NORTHBEAM_API_KEY` or `NORTHBEAM_CLIENT_ID` is missing, the server starts normally but individual tool calls will return a clear error message. Credentials are validated lazily at call time, not at startup.

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

4. **Fully quit and reopen** Claude Desktop (not just close the window).
5. Start a new chat and confirm the `northbeam` tools appear (e.g. `list_metrics`).

Credentials are loaded from the package `.env` via path resolution relative to `src/index.js`, so Claude’s launch working directory does not matter. Do **not** put API keys in `claude_desktop_config.json`.

### Troubleshoot Claude

- Tools missing → confirm the path exists (`ls` the `args` path) and Node is on your PATH (`which node`).
- Server crashes on start → check Claude MCP logs; missing env vars print to stderr.
- Never add `console.log` to this server — it breaks the JSON-RPC stdio channel.

---

## Connect in Cursor (local stdio)

Cursor spawns this server the exact same way as Claude Desktop — same Node process, same `.env`, same `command`/`args` shape. Only the config file location and a couple of UI steps differ.

1. Finish **Install locally** above (clone, `npm install`, `.env`).
2. Create the Cursor MCP config. Use one of:
   - Project-level (only active in this repo): `.cursor/mcp.json` in the repo root.
   - Global (active in every project): `~/.cursor/mcp.json`.
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

4. Open Cursor **Settings** → **Tools & MCP** and confirm the `northbeam` server shows a **green** status indicator. If it isn't green, toggle the server on (or hit reload) and wait for it to connect.
5. Open a new Composer/Agent chat and ask it to run `list_metrics` to confirm the tools are wired up.

Credentials are loaded from the package `.env` via path resolution relative to `src/index.js`, so Cursor’s launch working directory does not matter. Do **not** put API keys in `.cursor/mcp.json`.

### Troubleshoot Cursor

- Tools missing → confirm the path in `args` exists (`ls` the `args` path) and Node is on your PATH (`which node`).
- Server not green → wrong absolute path in `args` or `node` not found; use an absolute path to Node (e.g. `/opt/homebrew/bin/node`) if `node` isn’t resolved.
- Tools not appearing after a config edit → toggle the `northbeam` server off and back on in **Settings** → **Tools & MCP**, or reload the window.
- Never add `console.log` to this server — it breaks the JSON-RPC stdio channel.

---

## Connect in Manus (local STDIO)

When you connect a local STDIO server to Manus, Manus runs the server inside its own cloud sandbox — **not** on your local computer. This means your local `.env` file and local file paths are invisible to Manus. You must configure the connector so Manus can clone the repo and inject your credentials itself.

### Step 1 — Add the server in Manus

1. In Manus, open **Settings → Integrations → Custom MCP** and click **Add server**.
2. Fill in the form exactly like this:

| Field | What to enter |
|-------|---------------|
| **Server Name** | `northbeam` (or any name you like) |
| **Transport Type** | `STDIO` |
| **Command** | `node` |
| **Arguments** | `/home/ubuntu/Northbeam-MCP-Server/src/index.js` |
| **Environment variables** | **REQUIRED:** You must add `NORTHBEAM_API_KEY` and `NORTHBEAM_CLIENT_ID` here with your real credentials. |
| **Icon / Note** | Optional — skip if you want |

> **Important:** Do not use your local Mac/Windows paths. Use exactly `node` and `/home/ubuntu/Northbeam-MCP-Server/src/index.js`.

3. Click **Save / Connect**.

### Step 2 — Ask Manus to set it up

Start a new chat in Manus and paste this exact prompt:

```text
I've added the Northbeam MCP server to my connectors. Please set it up in the sandbox by running:
cd /home/ubuntu && gh repo clone aryangautam-source/Northbeam-MCP-Server && cd Northbeam-MCP-Server && npm install

Once done, test it by calling list_metrics.
```

Manus will clone the repo into its sandbox, install the dependencies, and the connector will start working because the credentials are securely injected from the environment variables you set in Step 1.

### Troubleshooting

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| "No such file or directory" | Repo not cloned in sandbox | Ask Manus to run the clone and install command from Step 2. |
| "Missing required environment variable" | Credentials not in Manus form | Go to Settings → Custom MCP and add `NORTHBEAM_API_KEY` and `NORTHBEAM_CLIENT_ID` to the Environment Variables section. |
| Auth / API errors | Invalid credentials | Check that your API key and Client ID are correct in the Manus connector settings. |

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

---

## Removing the connector

### Manus

1. Open **Settings → Integrations → Custom MCP**.
2. Find the `northbeam` entry and click **Delete**.
3. Start a new Manus chat and ask it to clean up the sandbox:

```text
Please delete the Northbeam MCP server repo from the sandbox:
rm -rf /home/ubuntu/Northbeam-MCP-Server
```

### Claude Desktop

1. Open `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows).
2. Delete the `northbeam` entry under `mcpServers`.
3. **Fully quit and reopen** Claude Desktop.

### Cursor

1. Open **Settings → MCP** (or edit `.cursor/mcp.json` in your project).
2. Delete the `northbeam` entry.
3. Restart Cursor.

### Local repo (all clients)

If you cloned the repo to your machine, delete it:

```bash
rm -rf /path/to/Northbeam-MCP-Server
```
