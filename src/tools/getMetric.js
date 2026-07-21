import { z } from 'zod';
import { northbeamClient } from '../northbeamClient.js';
import { requireDate, requireNonEmptyString, runTool } from './helpers.js';

export const name = 'get_metric';
export const description =
  'Fetch time-series values for a single Northbeam metric over a date range with an attribution model';

export const schema = {
  metric_name: z.string().describe('Northbeam metric ID (e.g. spend, rev, cac)'),
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  attribution_model: z
    .enum(['clicks_only', 'first_touch', 'last_touch'])
    .describe('Attribution model: clicks_only | first_touch | last_touch'),
};

export async function handler(args) {
  return runTool(async () => {
    requireNonEmptyString('metric_name', args.metric_name);
    requireDate('start_date', args.start_date);
    requireDate('end_date', args.end_date);
    requireNonEmptyString('attribution_model', args.attribution_model);

    return northbeamClient.getMetric({
      metric_name: args.metric_name,
      start_date: args.start_date,
      end_date: args.end_date,
      attribution_model: args.attribution_model,
    });
  });
}
