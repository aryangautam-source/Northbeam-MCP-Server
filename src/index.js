#!/usr/bin/env node
/**
 * northbeam-mcp — local stdio MCP server for Northbeam analytics.
 *
 * CRITICAL: Never use console.log here. stdout is the JSON-RPC channel.
 * All logging must go to console.error (stderr).
 */

// Must be the first import so env is available before any module that may
// eventually read process.env. Client credentials are still read lazily at
// call time as a second layer of protection against ESM import hoisting.
import 'dotenv/config';

import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Resolve .env relative to this file so the server works no matter which
// working directory Claude Desktop / the inspector launches it from.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
  path: path.resolve(__dirname, '../.env'),
});

import * as listMetrics from './tools/listMetrics.js';
import * as listDimensions from './tools/listDimensions.js';
import * as getMetric from './tools/getMetric.js';
import * as getChannelPerformance from './tools/getChannelPerformance.js';
import * as getCohortAnalysis from './tools/getCohortAnalysis.js';
import * as getAttribution from './tools/getAttribution.js';

function requireEnv(name) {
  if (!process.env[name] || String(process.env[name]).trim() === '') {
    const message = `Missing required environment variable: ${name}. Copy .env.example to .env and fill in your Northbeam credentials.`;
    console.error(message);
    throw new Error(message);
  }
}

requireEnv('NORTHBEAM_API_KEY');
requireEnv('NORTHBEAM_CLIENT_ID');

const tools = [
  listMetrics,
  listDimensions,
  getMetric,
  getChannelPerformance,
  getCohortAnalysis,
  getAttribution,
];

const server = new McpServer({
  name: 'northbeam-mcp',
  version: '1.0.0',
});

for (const tool of tools) {
  const hasParams = tool.schema && Object.keys(tool.schema).length > 0;
  if (hasParams) {
    server.tool(tool.name, tool.description, tool.schema, tool.handler);
  } else {
    server.tool(tool.name, tool.description, tool.handler);
  }
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('northbeam-mcp running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting northbeam-mcp:', err);
  process.exit(1);
});
