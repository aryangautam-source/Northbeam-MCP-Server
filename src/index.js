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

// Log all incoming requests
app.use((req, _res, next) => {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} | accept: ${req.headers['accept'] || '(none)'} | auth: ${req.headers['authorization'] ? 'present' : 'none'}`);
  next();
});

// Middleware: inject the Accept header required by StreamableHTTPServerTransport for any MCP path.
// manus-mcp-cli sends the correct Accept header but posts to "/" (root), not "/mcp".
// We apply this to all routes so it works regardless of which path the client uses.
// NOTE: @hono/node-server reads from req.rawHeaders, not req.headers, so we patch both.
function injectAcceptHeader(req, _res, next) {
  const accept = req.headers['accept'] || '';
  if (!accept.includes('text/event-stream')) {
    const newAccept = accept
      ? `${accept}, application/json, text/event-stream`
      : 'application/json, text/event-stream';
    req.headers['accept'] = newAccept;
    const rawHeaders = req.rawHeaders;
    const acceptIdx = rawHeaders.findIndex((v, i) => i % 2 === 0 && v.toLowerCase() === 'accept');
    if (acceptIdx !== -1) {
      rawHeaders[acceptIdx + 1] = newAccept;
    } else {
      rawHeaders.push('Accept', newAccept);
    }
  }
  next();
}

// Map of sessionId -> StreamableHTTPServerTransport for stateful sessions
const transports = new Map();

// Core MCP request handler - shared by both "/" and "/mcp" routes
async function handleMcpRequest(req, res) {
  try {
    // For GET requests (SSE stream), reuse the existing transport for the session if present
    if (req.method === 'GET') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId).handleRequest(req, res);
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

    // For POST requests with an existing session ID, reuse the existing transport
    if (req.method === 'POST') {
      const sessionId = req.headers['mcp-session-id'];
      if (sessionId && transports.has(sessionId)) {
        await transports.get(sessionId).handleRequest(req, res, req.body);
        return;
      }
    }

    // For POST (initialize) without a session ID, create a fresh server + transport
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
  } catch (err) {
    console.error('MCP request error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Handle MCP at root "/" — this is where manus-mcp-cli posts when the connector URL is the base URL
app.all('/', injectAcceptHeader, handleMcpRequest);

// Also handle MCP at "/mcp" for clients that append the path
app.all('/mcp', injectAcceptHeader, handleMcpRequest);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.error(`Northbeam MCP server running on port ${PORT}`);
});
