import axios, { AxiosInstance } from 'axios';
import { config, getBlizzardApiUrl } from '../config';
import { blizzardAuthService } from '../auth/blizzardAuth';
import { BlizzardAuctionHouseResponse, BlizzardItem } from '../types';
import { logger } from '../utils/logger';

class BlizzardApiService {
  private apiClient: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = getBlizzardApiUrl(config.BLIZZARD_REGION);
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });

    // Add request interceptor to inject auth token
    this.apiClient.interceptors.request.use(
      async (config) => {
        const token = await blizzardAuthService.getAccessToken();
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      },
      (error) => {
        logger.error('Request interceptor error', { error });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired, refresh and retry
          logger.warn('Access token expired, refreshing...');
          await blizzardAuthService.refreshToken();
          return this.apiClient.request(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch auction house data for a connected realm
   */
  async getAuctions(connectedRealmId: number): Promise<BlizzardAuctionHouseResponse> {
    try {
      logger.info('Fetching auctions', { connectedRealmId });

      const response = await this.apiClient.get<BlizzardAuctionHouseResponse>(
        `/data/wow/connected-realm/${connectedRealmId}/auctions`,
        {
          params: {
            namespace: `dynamic-${config.BLIZZARD_REGION}`,
            locale: 'en_US',
          },
        }
      );

      logger.info('Successfully fetched auctions', {
        connectedRealmId,
        auctionCount: response.data.auctions.length,
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch auctions', { connectedRealmId, error });
      throw error;
    }
  }

  /**
   * Fetch item data by ID
   */
  async getItem(itemId: number): Promise<BlizzardItem> {
    try {
      logger.debug('Fetching item data', { itemId });

      const response = await this.apiClient.get<BlizzardItem>(`/data/wow/item/${itemId}`, {
        params: {
          namespace: `static-classic-${config.BLIZZARD_REGION}`,
          locale: 'fr_FR',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch item', { itemId, error });
      throw error;
    }
  }

  /**
   * Fetch item media (icon)
   */
  async getItemMedia(itemId: number): Promise<string | null> {
    try {
      const response = await this.apiClient.get<{ assets: Array<{ key: string; value: string }> }>(
        `/data/wow/media/item/${itemId}`,
        {
          params: {
            namespace: `static-${config.BLIZZARD_REGION}`, // Use static-eu for Classic Anniversary
            locale: 'fr_FR',
          },
        }
      );

      const iconAsset = response.data.assets.find((asset) => asset.key === 'icon');
      return iconAsset?.value || null;
    } catch (error) {
      logger.error('Failed to fetch item media', { itemId, error });
      return null;
    }
  }

  /**
   * Get connected realm info
   */
  async getConnectedRealm(connectedRealmId: number) {
    try {
      const response = await this.apiClient.get(`/data/wow/connected-realm/${connectedRealmId}`, {
        params: {
          namespace: `dynamic-${config.BLIZZARD_REGION}`,
          locale: 'en_US',
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to fetch connected realm', { connectedRealmId, error });
      throw error;
    }
  }

  /**
   * Search for connected realms
   */
  async searchConnectedRealms() {
    try {
      const response = await this.apiClient.get('/data/wow/search/connected-realm', {
        params: {
          namespace: `dynamic-${config.BLIZZARD_REGION}`,
          locale: 'en_US',
          'status.type': 'UP',
          orderby: 'id',
          _page: 1,
        },
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to search connected realms', { error });
      throw error;
    }
  }
}

export const blizzardApiService = new BlizzardApiService();
