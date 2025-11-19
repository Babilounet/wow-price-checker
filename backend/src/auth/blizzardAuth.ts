import axios from 'axios';
import { config, getBlizzardOAuthUrl } from '../config';
import { BlizzardOAuthToken } from '../types';
import { logger } from '../utils/logger';

class BlizzardAuthService {
  private accessToken: string | null = null;
  private tokenExpiresAt: number | null = null;

  /**
   * Get OAuth access token (cached or refresh if expired)
   */
  async getAccessToken(): Promise<string> {
    // Check if current token is still valid
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Fetch new token
    return this.fetchNewToken();
  }

  /**
   * Fetch new access token from Blizzard OAuth
   */
  private async fetchNewToken(): Promise<string> {
    try {
      const oauthUrl = getBlizzardOAuthUrl(config.BLIZZARD_REGION);
      const tokenUrl = `${oauthUrl}/token`;

      const response = await axios.post<BlizzardOAuthToken>(
        tokenUrl,
        'grant_type=client_credentials',
        {
          auth: {
            username: config.BLIZZARD_CLIENT_ID,
            password: config.BLIZZARD_CLIENT_SECRET,
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { access_token, expires_in } = response.data;

      // Store token with buffer time (expire 5 minutes early)
      this.accessToken = access_token;
      this.tokenExpiresAt = Date.now() + (expires_in - 300) * 1000;

      logger.info('Successfully obtained Blizzard OAuth token', {
        expiresIn: expires_in,
        region: config.BLIZZARD_REGION,
      });

      return access_token;
    } catch (error) {
      logger.error('Failed to obtain Blizzard OAuth token', { error });
      throw new Error('Failed to authenticate with Blizzard API');
    }
  }

  /**
   * Force token refresh
   */
  async refreshToken(): Promise<string> {
    this.accessToken = null;
    this.tokenExpiresAt = null;
    return this.fetchNewToken();
  }

  /**
   * Check if current token is valid
   */
  isTokenValid(): boolean {
    return !!(this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt);
  }

  /**
   * Clear cached token
   */
  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }
}

export const blizzardAuthService = new BlizzardAuthService();
