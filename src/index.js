#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { SSEServerTransport } = await import('@modelcontextprotocol/sdk/server/sse.js');
const { server } = await import('./server.js');

console.error('Starting Northbeam MCP server...');

if (!process.env.NORTHBEAM_API_KEY) {
  console.error('Error: NORTHBEAM_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.NORTHBEAM_CLIENT_ID) {
  console.error('Error: NORTHBEAM_CLIENT_ID environment variable is required');
  process.exit(1);
}

if (!process.env.MCP_AUTH_TOKEN) {
  console.error('Error: MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'northbeam-mcp' });
});

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;
  if (!token || token !== process.env.MCP_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const transports = {};

app.get('/mcp', requireAuth, async (req, res) => {
  const transport = new SSEServerTransport('/messages', res);
  transports[transport.sessionId] = transport;
  res.on('close', () => {
    delete transports[transport.sessionId];
  });
  await server.connect(transport);
});

app.post('/messages', requireAuth, async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) {
    return res.status(400).json({ error: 'No transport for session' });
  }
  await transport.handlePostMessage(req, res);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`Northbeam MCP server running on port ${PORT}`);
});
