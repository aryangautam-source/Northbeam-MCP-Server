/**
 * Loads environment variables from the package-root .env — early and quietly.
 *
 * `quiet: true` is REQUIRED, not cosmetic: dotenv >= 17 prints an "injected env"
 * banner to stdout by default, and in this server stdout is the MCP JSON-RPC
 * channel. Any stray byte there corrupts the protocol handshake. See the header
 * of index.js.
 *
 * The path is resolved relative to this file (not the process cwd) so the server
 * works no matter which working directory the host launches it from — Claude
 * Desktop, Cursor, Manus, or the MCP Inspector.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});
