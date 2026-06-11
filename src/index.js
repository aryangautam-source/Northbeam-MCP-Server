#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { server } from './server.js';
import dotenv from 'dotenv';

dotenv.config();

console.error('Starting Northbeam MCP server...');

if (!process.env.NORTHBEAM_API_KEY) {
  console.error('Error: NORTHBEAM_API_KEY environment variable is required');
  console.error('Please create a .env file with your Northbeam API key');
  process.exit(1);
}

if (!process.env.NORTHBEAM_CLIENT_ID) {
  console.error('Error: NORTHBEAM_CLIENT_ID environment variable is required');
  console.error('Please create a .env file with your Northbeam client ID');
  process.exit(1);
}

const transport = new StdioServerTransport();
await server.connect(transport);
