/**
 * Northbeam Data Export API client.
 *
 * Credentials are read from process.env at call time (not at import/module-load
 * time) so dotenv can finish loading before any request runs.
 */

const BASE_URL = 'https://api.northbeam.io/v1';
const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

const ATTRIBUTION_MODEL_MAP = {
  clicks_only: 'northbeam_custom',
  first_touch: 'first_touch',
  last_touch: 'last_touch',
};

function getCredentials() {
  const apiKey = process.env.NORTHBEAM_API_KEY;
  const clientId = process.env.NORTHBEAM_CLIENT_ID;

  if (!apiKey || !clientId) {
    throw new Error(
      'Missing Northbeam credentials. Set NORTHBEAM_API_KEY and NORTHBEAM_CLIENT_ID in the environment or .env file.'
    );
  }

  return { apiKey, clientId };
}

function authHeaders() {
  const { apiKey, clientId } = getCredentials();
  return {
    Authorization: `Basic ${apiKey}`,
    'Data-Client-ID': clientId,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Northbeam API returned invalid JSON (HTTP ${response.status}): ${text.slice(0, 200)}`
    );
  }

  if (!response.ok) {
    const message =
      (body && (body.message || body.error || JSON.stringify(body))) ||
      text ||
      response.statusText;
    throw new Error(`Northbeam API error (HTTP ${response.status}): ${message}`);
  }

  return body;
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: authHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new Error(`Network error calling Northbeam API (${method} ${path}): ${err.message}`);
  }

  return parseJsonResponse(response);
}

function toPeriodOptions(startDate, endDate) {
  return {
    period_starting_at: `${startDate}T00:00:00Z`,
    period_ending_at: `${endDate}T23:59:59Z`,
  };
}

function resolveAttributionModel(model) {
  if (!model) {
    throw new Error('attribution model is required');
  }
  return ATTRIBUTION_MODEL_MAP[model] || model;
}

/**
 * Parse a CSV string into an array of row objects (header → values).
 */
function parseCsv(csvText) {
  const lines = String(csvText).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return rows;
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

async function downloadCsv(url) {
  let response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(`Network error downloading export CSV: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to download export CSV (HTTP ${response.status})`);
  }

  return response.text();
}

export const northbeamClient = {
  ATTRIBUTION_MODEL_MAP,

  async listMetrics() {
    return request('GET', '/exports/metrics');
  },

  async listDimensions() {
    return request('GET', '/exports/breakdowns');
  },

  async createExport(payload) {
    const data = await request('POST', '/exports/data-export', payload);
    if (!data?.id) {
      throw new Error(`Export creation response missing id: ${JSON.stringify(data)}`);
    }
    return data.id;
  },

  /**
   * Poll export result every ~2.5s until status === "SUCCESS", or throw after 60s.
   * Returns the first download URL from result[].
   */
  async pollExport(exportId) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      const data = await request('GET', `/exports/data-export/result/${exportId}`);
      const { status, result } = data;

      if (status === 'SUCCESS') {
        if (!Array.isArray(result) || result.length === 0) {
          throw new Error(`Export ${exportId} succeeded but returned no download URL`);
        }
        return result[0];
      }

      if (status === 'ERROR') {
        throw new Error(`Northbeam export ${exportId} failed with status ERROR`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    throw new Error(
      `Northbeam export ${exportId} timed out after ${POLL_TIMEOUT_MS / 1000}s waiting for SUCCESS`
    );
  },

  async runExport(payload) {
    const exportId = await this.createExport(payload);
    console.error(`Northbeam export created: ${exportId}`);
    const downloadUrl = await this.pollExport(exportId);
    const csv = await downloadCsv(downloadUrl);
    return parseCsv(csv);
  },

  async getMetric({ metric_name, start_date, end_date, attribution_model }) {
    const model = resolveAttributionModel(attribution_model);
    return this.runExport({
      level: 'platform',
      time_granularity: 'DAILY',
      period_type: 'FIXED',
      period_options: toPeriodOptions(start_date, end_date),
      options: {
        export_aggregation: 'BREAKDOWN',
        remove_zero_spend: false,
        aggregate_data: true,
      },
      attribution_options: {
        attribution_models: [model],
        accounting_modes: ['accrual'],
        attribution_windows: ['1'],
      },
      metrics: [{ id: metric_name }],
    });
  },

  async getChannelPerformance({ start_date, end_date, attribution_model, channel }) {
    const model = resolveAttributionModel(attribution_model);
    const payload = {
      level: 'platform',
      time_granularity: 'DAILY',
      period_type: 'FIXED',
      period_options: toPeriodOptions(start_date, end_date),
      options: {
        export_aggregation: 'BREAKDOWN',
        remove_zero_spend: false,
        aggregate_data: false,
        include_kind_and_platform: true,
      },
      attribution_options: {
        attribution_models: [model],
        accounting_modes: ['accrual'],
        attribution_windows: ['1'],
      },
      metrics: [
        { id: 'spend' },
        { id: 'rev' },
        { id: 'cac' },
        { id: 'transactions' },
      ],
      breakdowns: [
        {
          key: 'Platform (Northbeam)',
          ...(channel ? { values: [channel] } : {}),
        },
      ],
    };

    return this.runExport(payload);
  },

  async getCohortAnalysis({ start_date, end_date, cohort_dimension }) {
    return this.runExport({
      level: 'platform',
      time_granularity: 'DAILY',
      period_type: 'FIXED',
      period_options: toPeriodOptions(start_date, end_date),
      options: {
        export_aggregation: 'BREAKDOWN',
        remove_zero_spend: false,
        aggregate_data: false,
      },
      attribution_options: {
        attribution_models: ['first_touch'],
        accounting_modes: ['accrual'],
        attribution_windows: ['1'],
      },
      metrics: [
        { id: 'spend' },
        { id: 'rev' },
        { id: 'transactions' },
        { id: 'aov' },
      ],
      breakdowns: [
        {
          key: cohort_dimension,
        },
      ],
    });
  },

  async getAttribution({ model, start_date, end_date, metrics }) {
    const attributionModel = resolveAttributionModel(model);
    return this.runExport({
      level: 'platform',
      time_granularity: 'DAILY',
      period_type: 'FIXED',
      period_options: toPeriodOptions(start_date, end_date),
      options: {
        export_aggregation: 'BREAKDOWN',
        remove_zero_spend: false,
        aggregate_data: false,
      },
      attribution_options: {
        attribution_models: [attributionModel],
        accounting_modes: ['accrual'],
        attribution_windows: ['1'],
      },
      metrics: metrics.map((id) => ({ id })),
      breakdowns: [
        {
          key: 'Platform (Northbeam)',
        },
      ],
    });
  },
};
