import axios, { AxiosInstance } from 'axios';
import { ApiResponse, PriceStatistics, BlizzardItem } from '../types';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get price statistics for an item
   */
  async getPriceStats(realmId: number, itemId: number): Promise<PriceStatistics> {
    const response = await this.client.get<ApiResponse<PriceStatistics>>(
      `/auctions/${realmId}/prices/${itemId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch price statistics');
    }
    return response.data.data;
  }

  /**
   * Get price statistics for multiple items
   */
  async getBulkPriceStats(realmId: number, itemIds: number[]): Promise<PriceStatistics[]> {
    const response = await this.client.post<ApiResponse<PriceStatistics[]>>(
      `/auctions/${realmId}/prices/bulk`,
      { itemIds }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch bulk price statistics');
    }
    return response.data.data;
  }

  /**
   * Get item data
   */
  async getItem(itemId: number): Promise<BlizzardItem> {
    const response = await this.client.get<ApiResponse<BlizzardItem>>(`/items/${itemId}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch item data');
    }
    return response.data.data;
  }

  /**
   * Get item icon URL
   */
  async getItemMedia(itemId: number): Promise<string> {
    const response = await this.client.get<ApiResponse<{ iconUrl: string }>>(
      `/items/${itemId}/media`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch item media');
    }
    return response.data.data.iconUrl;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const apiClient = new ApiClient();
