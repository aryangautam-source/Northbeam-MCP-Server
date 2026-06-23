import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class NorthbeamClient {
  constructor() {
    this.apiKey = process.env.NORTHBEAM_API_KEY;
    this.clientId = process.env.NORTHBEAM_CLIENT_ID;
    this.baseUrl = 'https://api.northbeam.io/v1';
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${this.apiKey}`,
        'Data-Client-ID': this.clientId,
        'accept': 'application/json'
      }
    });
  }

  async listMetrics() {
    try {
      const response = await this.client.get('/exports/metrics');
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async listDimensions() {
    try {
      const response = await this.client.get('/exports/breakdowns');
      return response.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async createExport(options) {
    try {
      const response = await this.client.post('/exports/data-export', options);
      return response.data.id;
    } catch (error) {
      this._handleError(error);
    }
  }

  async pollExport(exportId) {
    const maxAttempts = 60;
    const delayMs = 5000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.client.get(`/exports/data-export/result/${exportId}`);
      const { status, result } = response.data;

      if (status === 'SUCCESS') {
        return result[0];
      } else if (status === 'ERROR') {
        throw new Error(`Export failed for export ID: ${exportId}`);
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw new Error('Export timed out after 5 minutes');
  }

  async getChannelPerformance(startDate, endDate, metrics) {
    try {
      const exportId = await this.createExport({
        level: 'ad',
        time_granularity: 'DAILY',
        period_type: 'FIXED',
        period_options: {
          start_date: startDate,
          end_date: endDate
        },
        options: {
          export_aggregation: 'BREAKDOWN',
          remove_zero_spend: false,
          aggregate_data: false
        },
        attribution_options: {
          attribution_models: ['northbeam_custom', 'last_touch', 'first_touch'],
          accounting_modes: ['accrual'],
          attribution_windows: ['1']
        },
        metrics: metrics.map(id => ({ id }))
      });

      const downloadUrl = await this.pollExport(exportId);
      const csvResponse = await axios.get(downloadUrl);
      return csvResponse.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  async getAttribution(model, startDate, endDate, metrics) {
    try {
      const exportId = await this.createExport({
        level: 'ad',
        time_granularity: 'DAILY',
        period_type: 'FIXED',
        period_options: {
          start_date: startDate,
          end_date: endDate
        },
        options: {
          export_aggregation: 'BREAKDOWN',
          remove_zero_spend: false,
          aggregate_data: false
        },
        attribution_options: {
          attribution_models: [model],
          accounting_modes: ['accrual'],
          attribution_windows: ['1']
        },
        metrics: metrics.map(id => ({ id }))
      });

      const downloadUrl = await this.pollExport(exportId);
      const csvResponse = await axios.get(downloadUrl);
      return csvResponse.data;
    } catch (error) {
      this._handleError(error);
    }
  }

  _handleError(error) {
    if (error.response) {
      const errorMessage = error.response.data.message || JSON.stringify(error.response.data);
      throw new Error(`API Error (${error.response.status}): ${errorMessage}`);
    } else if (error.request) {
      throw new Error('No response received from Northbeam API');
    } else {
      throw new Error(`Request Error: ${error.message}`);
    }
  }
}

export const northbeamClient = new NorthbeamClient();
