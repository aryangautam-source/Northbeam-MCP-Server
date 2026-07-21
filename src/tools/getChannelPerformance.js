import { z } from 'zod';
import { northbeamClient } from '../northbeamClient.js';
import { requireDate, requireNonEmptyString, runTool } from './helpers.js';

export const name = 'get_channel_performance';
export const description =
  'Fetch channel (platform) performance for a date range, optionally filtered to a single channel';

export const schema = {
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  attribution_model: z
    .enum(['clicks_only', 'first_touch', 'last_touch'])
    .describe('Attribution model: clicks_only | first_touch | last_touch'),
  channel: z
    .string()
    .optional()
    .describe('Optional Platform (Northbeam) channel filter, e.g. "Facebook Ads"'),
};

export async function handler(args) {
  return runTool(async () => {
    requireDate('start_date', args.start_date);
    requireDate('end_date', args.end_date);
    requireNonEmptyString('attribution_model', args.attribution_model);

    if (args.channel !== undefined) {
      requireNonEmptyString('channel', args.channel);
    }

    return northbeamClient.getChannelPerformance({
      start_date: args.start_date,
      end_date: args.end_date,
      attribution_model: args.attribution_model,
      channel: args.channel,
    });
  });
}
