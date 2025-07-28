import axios, { AxiosError } from 'axios';
import { appConfig, ENDPOINTS } from './config';
import { log } from './logger';
import {
  GBPLocalPost,
  GBPCreatePostRequest,
  GBPCreatePostResponse,
  GBPTokenResponse,
  InstagramPost,
} from './types';

export class GoogleBusinessProfileAPI {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    // Token will be refreshed on first use
  }

  // Refresh OAuth2 access token
  private async refreshAccessToken(): Promise<string> {
    try {
      log.debug('GBP アクセストークンを更新中');

      const response = await axios.post<GBPTokenResponse>(
        ENDPOINTS.gbp.refreshToken,
        {
          client_id: appConfig.gbp.clientId,
          client_secret: appConfig.gbp.clientSecret,
          refresh_token: appConfig.gbp.refreshToken,
          grant_type: 'refresh_token',
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);

      log.info('GBP アクセストークンの更新に成功', {
        expiresIn: response.data.expires_in,
      });

      return this.accessToken;
    } catch (error) {
      const axiosError = error as AxiosError;
      log.error('GBP アクセストークンの更新に失敗', {
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(`GBP トークン更新に失敗: ${axiosError.message}`);
    }
  }

  // Get valid access token (refresh if needed)
  private async getValidAccessToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt - 60000) {
      // Refresh if no token or expires within 1 minute
      await this.refreshAccessToken();
    }
    return this.accessToken!;
  }

  // Create a local post on Google Business Profile
  async createLocalPost(instagramPost: InstagramPost): Promise<string> {
    try {
      const accessToken = await this.getValidAccessToken();
      const localPost = this.convertInstagramToGBPPost(instagramPost);
      
      const createPostRequest: GBPCreatePostRequest = {
        localPost,
        validateOnly: false,
      };

      const url = ENDPOINTS.gbp.createPost(appConfig.gbp.accountId, appConfig.gbp.locationId);

      log.debug('GBP ローカル投稿を作成中', {
        instagramPostId: instagramPost.id,
        summary: localPost.summary.substring(0, 100) + '...',
      });

      const response = await axios.post<GBPCreatePostResponse>(
        url,
        createPostRequest,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      log.info('GBP ローカル投稿の作成に成功', {
        instagramPostId: instagramPost.id,
        gbpPostId: response.data.name,
        state: response.data.state,
      });

      return response.data.name;
    } catch (error) {
      const axiosError = error as AxiosError;
      log.error('GBP ローカル投稿の作成に失敗', {
        instagramPostId: instagramPost.id,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(`GBP 投稿作成に失敗: ${axiosError.message}`);
    }
  }

  // Convert Instagram post to GBP local post format
  private convertInstagramToGBPPost(instagramPost: InstagramPost): GBPLocalPost {
    // Extract caption and clean it up
    let summary = instagramPost.caption || 'Check out our latest post on Instagram!';
    
    // Remove hashtags for cleaner GBP post (optional)
    summary = summary.replace(/#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi, '').trim();
    
    // Limit summary to GBP requirements (1500 characters max)
    if (summary.length > 1500) {
      summary = summary.substring(0, 1497) + '...';
    }

    // クリーニング後にサマリーが空の場合、デフォルトを使用
    if (!summary || summary.length < 10) {
      summary = '最新の投稿をチェック！詳細は Instagram をご覧ください。';
    }

    const localPost: GBPLocalPost = {
      languageCode: 'en-US',
      summary,
      topicType: 'STANDARD',
      callToAction: {
        actionType: 'LEARN_MORE',
        url: instagramPost.permalink,
      },
    };

    // Add media if available and it's an image
    if (instagramPost.media_url && instagramPost.media_type === 'IMAGE') {
      localPost.media = [
        {
          mediaFormat: 'PHOTO',
          sourceUrl: instagramPost.media_url,
        },
      ];
    }

    return localPost;
  }

  // Validate post before creation (dry run)
  async validateLocalPost(instagramPost: InstagramPost): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      const accessToken = await this.getValidAccessToken();
      const localPost = this.convertInstagramToGBPPost(instagramPost);
      
      const validateRequest: GBPCreatePostRequest = {
        localPost,
        validateOnly: true,
      };

      const url = ENDPOINTS.gbp.createPost(appConfig.gbp.accountId, appConfig.gbp.locationId);

      await axios.post(url, validateRequest, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      log.debug('GBP 投稿の検証に成功', {
        instagramPostId: instagramPost.id,
      });

      return { isValid: true };
    } catch (error) {
      const axiosError = error as AxiosError;
      
      log.warn('GBP 投稿の検証に失敗', {
        instagramPostId: instagramPost.id,
        error: axiosError.message,
        data: axiosError.response?.data,
      });

      return {
        isValid: false,
        errors: [axiosError.message],
      };
    }
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string; data?: object }> {
    try {
      const accessToken = await this.getValidAccessToken();
      
      // Test by trying to validate a dummy post
      const dummyPost: InstagramPost = {
        id: 'test',
        caption: 'Test post for connection validation',
        media_type: 'IMAGE',
        permalink: 'https://instagram.com/test',
        timestamp: new Date().toISOString(),
      };

      const validation = await this.validateLocalPost(dummyPost);
      
      return {
        success: true,
        message: 'GBP API 接続成功',
        data: {
          accountId: appConfig.gbp.accountId,
          locationId: appConfig.gbp.locationId,
          tokenValid: !!accessToken,
          validationWorking: validation.isValid,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `GBP API 接続に失敗: ${(error as Error).message}`,
      };
    }
  }

  // Get current token status
  getTokenStatus(): { hasToken: boolean; expiresAt?: Date; isExpired: boolean } {
    return {
      hasToken: !!this.accessToken,
      expiresAt: this.tokenExpiresAt ? new Date(this.tokenExpiresAt) : undefined,
      isExpired: Date.now() >= this.tokenExpiresAt,
    };
  }
}

export const gbpAPI = new GoogleBusinessProfileAPI();