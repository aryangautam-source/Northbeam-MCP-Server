import { z } from 'zod';
import { northbeamClient } from '../northbeamClient.js';
import { requireDate, requireNonEmptyString, requireStringArray, runTool } from './helpers.js';

export const name = 'get_attribution';
export const description =
  'Fetch attribution-broken-down performance for a model, date range, and metric list';

export const schema = {
  model: z
    .string()
    .describe(
      'Attribution model: clicks_only | first_touch | last_touch, or a raw Northbeam model id'
    ),
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  metrics: z.array(z.string()).describe('Array of Northbeam metric IDs to include'),
};

export async function handler(args) {
  return runTool(async () => {
    requireNonEmptyString('model', args.model);
    requireDate('start_date', args.start_date);
    requireDate('end_date', args.end_date);
    requireStringArray('metrics', args.metrics);

    return northbeamClient.getAttribution({
      model: args.model,
      start_date: args.start_date,
      end_date: args.end_date,
      metrics: args.metrics,
    });
  });
}
