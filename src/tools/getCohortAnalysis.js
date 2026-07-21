import { z } from 'zod';
import { northbeamClient } from '../northbeamClient.js';
import { requireDate, requireNonEmptyString, runTool } from './helpers.js';

export const name = 'get_cohort_analysis';
export const description =
  'Fetch cohort-style breakdown analysis for a date range using a Northbeam dimension key';

export const schema = {
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  cohort_dimension: z
    .string()
    .describe('Breakdown/dimension key to cohort by (from list_dimensions), e.g. "Platform (Northbeam)"'),
};

export async function handler(args) {
  return runTool(async () => {
    requireDate('start_date', args.start_date);
    requireDate('end_date', args.end_date);
    requireNonEmptyString('cohort_dimension', args.cohort_dimension);

    return northbeamClient.getCohortAnalysis({
      start_date: args.start_date,
      end_date: args.end_date,
      cohort_dimension: args.cohort_dimension,
    });
  });
}
