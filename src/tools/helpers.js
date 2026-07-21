/**
 * Shared helpers for MCP tool handlers.
 * Never use console.log — stdout is reserved for JSON-RPC.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function ok(data) {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

export function fail(message) {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

export function requireDate(name, value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new Error(`Invalid or missing ${name}: expected YYYY-MM-DD`);
  }
}

export function requireNonEmptyString(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid or missing ${name}: expected a non-empty string`);
  }
}

export function requireStringArray(name, value) {
  if (!Array.isArray(value) || value.length === 0 || value.some((v) => typeof v !== 'string' || !v.trim())) {
    throw new Error(`Invalid or missing ${name}: expected a non-empty array of strings`);
  }
}

export async function runTool(fn) {
  try {
    const data = await fn();
    return ok(data);
  } catch (err) {
    console.error(`Tool error: ${err.message}`);
    return fail(err.message);
  }
}
