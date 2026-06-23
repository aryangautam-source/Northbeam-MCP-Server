#!/usr/bin/env node
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { StreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createServer } = await import('./server.js');

console.error('Starting Northbeam MCP server...');

if (!process.env.NORTHBEAM_API_KEY) {
  console.error('Error: NORTHBEAM_API_KEY environment variable is required');
  process.exit(1);
}

if (!process.env.NORTHBEAM_CLIENT_ID) {
  console.error('Error: NORTHBEAM_CLIENT_ID environment variable is required');
  process.exit(1);
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'northbeam-mcp' });
});

// Log all incoming requests to help diagnose connection issues
app.use((req, _res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} | accept: ${req.headers['accept'] || '(none)'} | auth: ${req.headers['authorization'] ? 'present' : 'none'}`);
  next();
});

// Middleware: ensure /mcp requests always carry the Accept header required by StreamableHTTPServerTransport.
// Some MCP clients (including manus-mcp-cli) don't send it, causing a 406 Not Acceptable error.
// NOTE: The underlying @hono/node-server reads from req.rawHeaders (the flat array), not req.headers,
// so we must patch both to ensure the injected value is visible to the transport.
app.use('/mcp', (req, _res, next) => {
  const accept = req.headers['accept'] || '';
  if (!accept.includes('text/event-stream')) {
    const newAccept = accept
      ? `${accept}, application/json, text/event-stream`
      : 'application/json, text/event-stream';
    // Patch the parsed headers object (used by Express)
    req.headers['accept'] = newAccept;
    // Patch rawHeaders (flat array used by @hono/node-server inside StreamableHTTPServerTransport)
    const rawHeaders = req.rawHeaders;
    const acceptIdx = rawHeaders.findIndex((v, i) => i % 2 === 0 && v.toLowerCase() === 'accept');
    if (acceptIdx !== -1) {
      rawHeaders[acceptIdx + 1] = newAccept;
    } else {
      rawHeaders.push('Accept', newAccept);
    }
  }
  next();
});

// Map of sessionId -> StreamableHTTPServerTransport for stateful sessions
const transports = new Map();

// Single endpoint handles all MCP traffic (POST for JSON-RPC, GET for SSE stream, DELETE to close)
// No auth required on /mcp - the Railway URL is private and Northbeam API keys are protected server-side
app.all('/mcp', async (req, res) => {
  try {
    // For GET requests (SSE stream), reuse the existing transport for the session if present
    if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
        return;
      }
    }

    // For DELETE requests, close the session transport
    if (req.method === 'DELETE') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId);
        await transport.handleRequest(req, res);
        transports.delete(sessionId);
        return;
      }
      return res.status(404).json({ error: 'Session not found' });
    }

    // For POST (initialize or subsequent requests), create a fresh server + transport per session
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports.set(sessionId, transport);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    // Clean up server when transport closes
    transport.onclose = () => {
      if (transport.sessionId) {
        transports.delete(transport.sessionId);
      }
    };
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`Northbeam MCP server running on port ${PORT}`);
});
