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

4. **Fully quit and reopen** Claude Desktop (not just close the window).
5. Start a new chat and confirm the `northbeam` tools appear (e.g. `list_metrics`).

Credentials are loaded from the package `.env` via path resolution relative to `src/index.js`, so Claude’s launch working directory does not matter. Do **not** put API keys in `claude_desktop_config.json`.

### Troubleshoot Claude

- Tools missing → confirm the path exists (`ls` the `args` path) and Node is on your PATH (`which node`).
- Server crashes on start → check Claude MCP logs; missing env vars print to stderr.
- Never add `console.log` to this server — it breaks the JSON-RPC stdio channel.

---

## Connect in Manus (local STDIO)

Manus needs to know two things: where Node.js is on your computer, and where this repo's entry file is. Follow these steps carefully — most connection failures happen because one of those two paths is wrong.

### Step 1 — Find your Node.js path

Open a terminal and run:

```bash
which node
```

You'll get back something like `/home/ubuntu/.nvm/versions/node/v22.13.0/bin/node` or `/opt/homebrew/bin/node`. **Copy that output.** You'll paste it into Manus in a moment.

> **Why this matters:** Manus needs the full, exact path to Node.js on your machine. There is no universal default — it's different on every computer. If you leave the example path in or guess, the connection will fail with a confusing error.

### Step 2 — Find your script path

In the same terminal, go into the repo folder and run:

```bash
cd Northbeam-MCP-Server
echo "$(pwd)/src/index.js"
```

Copy that output too (e.g. `/Users/yourname/Northbeam-MCP-Server/src/index.js`).

### Step 3 — Add the server in Manus

1. Make sure you've completed **Install locally** above (clone, `npm install`, `.env`).
2. In Manus, open **Settings → Integrations → Custom MCP** and click **Add server**.
3. Fill in the form using your copied paths:

| Field | What to enter |
|-------|---------------|
| **Server Name** | `northbeam` (or any name you like) |
| **Transport Type** | `STDIO` |
| **Command** | Paste the output of `which node` from Step 1 |
| **Arguments** | Paste the script path from Step 2 |
| **Environment variables** | Leave blank if your `.env` file is already filled in. Otherwise add `NORTHBEAM_API_KEY` and `NORTHBEAM_CLIENT_ID` here. |
| **Icon / Note** | Optional — skip if you want |

4. Click **Save / Connect**.
5. Open a new Manus chat and ask it to run `list_metrics` — if you see a list of metrics, you're connected.

### Troubleshooting

| Symptom | Most likely cause | Fix |
|---------|-------------------|-----|
| Connection fails immediately | Wrong Node path in **Command** | Re-run `which node` and paste the exact output |
| "No such file" error | Wrong script path in **Arguments** | Re-run the `echo` command in Step 2 and paste the exact output |
| Tools don't appear | `npm install` was never run | Run `npm install` inside the repo folder, then reconnect |
| Auth / API errors | Missing credentials | Make sure `.env` has `NORTHBEAM_API_KEY` and `NORTHBEAM_CLIENT_ID`, or add them under **Environment variables** in the Manus form |

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
