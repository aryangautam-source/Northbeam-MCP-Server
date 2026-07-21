import { northbeamClient } from '../northbeamClient.js';
import { runTool } from './helpers.js';

export const name = 'list_metrics';
export const description = 'List all available Northbeam metric IDs and labels';
export const schema = {};

export async function handler() {
  return runTool(() => northbeamClient.listMetrics());
}
