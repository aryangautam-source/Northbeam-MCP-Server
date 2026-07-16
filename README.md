# Northbeam MCP Server

A Model Context Protocol (MCP) server for **VKTRY Gear** that exposes Northbeam marketing analytics to AI clients. Query metrics, dimensions, channel performance, attribution, and cohort data through Claude Desktop, Manus, or any MCP-compatible client.

**Hosted endpoint:** `https://northbeam-mcp-server-production.up.railway.app/mcp`

---

## Connect via Claude Desktop

Add the hosted server to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "northbeam": {
      "url": "https://northbeam-mcp-server-production.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

Replace `YOUR_MCP_AUTH_TOKEN` with the Bearer token from Railway (or your local `.env` `MCP_AUTH_TOKEN`). Restart Claude Desktop after saving.

---

## Connect via Manus

1. Open Manus MCP / custom server settings.
2. Set the server URL to:
   ```
   https://northbeam-mcp-server-production.up.railway.app/mcp
   ```
3. Add an Authorization header:
   ```
   Bearer YOUR_MCP_AUTH_TOKEN
   ```
4. Save and reconnect.

---

## Available tools

| Tool | Description |
|------|-------------|
| `list_metrics` | List available Northbeam metrics |
| `list_dimensions` | List available Northbeam dimensions |
| `get_channel_performance` | Channel performance data |
| `get_attribution` | Attribution data |
| `get_cohort_analysis` | Cohort analysis data |
| `get_metric` | Fetch data for a specific metric |

---

## Verify the connection

The health endpoint does not require auth:

```bash
curl https://northbeam-mcp-server-production.up.railway.app/health
```

Expected response:

```json
{"status":"ok","service":"northbeam-mcp"}
```

To confirm auth works against the MCP endpoint:

```bash
curl -H "Authorization: Bearer YOUR_MCP_AUTH_TOKEN" \
  https://northbeam-mcp-server-production.up.railway.app/mcp
```

---

## Run locally (development)

```bash
git clone https://github.com/aryangautam-source/Northbeam-MCP-Server.git
cd Northbeam-MCP-Server
npm install
```

Create a `.env` file in the project root:

```
NORTHBEAM_API_KEY=your_northbeam_api_key
NORTHBEAM_CLIENT_ID=your_northbeam_client_id
MCP_AUTH_TOKEN=your_bearer_token
```

Start the server:

```bash
npm start
```

The server listens on `PORT` (default `3000`). Local MCP URL: `http://localhost:3000/mcp`.

Optional scripts:

- `npm run dev` — start with file watching
- `npm run inspect` — open the MCP Inspector

---

## Security

- **Never commit `.env`** — it is gitignored. Credentials must not land in the repository.
- Production secrets (`NORTHBEAM_API_KEY`, `NORTHBEAM_CLIENT_ID`, `MCP_AUTH_TOKEN`) live in **Railway environment variables** only.
- The MCP and message endpoints require a valid Bearer token; do not share or hardcode that token in docs, configs checked into git, or chat logs.
