import { northbeamClient } from '../northbeamClient.js';
import { runTool } from './helpers.js';

export const name = 'list_dimensions';
export const description = 'List all available Northbeam dimension (breakdown) IDs and labels';
export const schema = {};

export async function handler() {
  return runTool(() => northbeamClient.listDimensions());
}
