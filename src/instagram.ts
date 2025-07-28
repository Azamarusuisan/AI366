import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import { appConfig, ENDPOINTS } from './config';
import { log } from './logger';
import {
  InstagramPost,
  InstagramMediaResponse,
  InstagramWebhookPayload,
  InstagramWebhookEntry,
} from './types';

export class InstagramAPI {
  private readonly accessToken: string;
  private readonly businessAccountId: string;
  private readonly webhookVerifyToken: string;

  constructor() {
    this.accessToken = appConfig.instagram.accessToken;
    this.businessAccountId = appConfig.instagram.businessAccountId;
    this.webhookVerifyToken = appConfig.instagram.webhookVerifyToken;
  }

  // Get recent media from Instagram Business Account
  async getRecentMedia(limit = 25, since?: string): Promise<InstagramPost[]> {
    try {
      const url = ENDPOINTS.instagram.media(this.businessAccountId);
      const params: Record<string, string> = {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
        limit: limit.toString(),
        access_token: this.accessToken,
      };

      if (since) {
        params.since = since;
      }

      log.debug('Instagram メディアを取得中', { url, params: { ...params, access_token: '[非表示]' } });

      const response = await axios.get<InstagramMediaResponse>(url, { params });

      log.info('Instagram メディアの取得に成功', {
        count: response.data.data.length,
        hasNext: !!response.data.paging?.next,
      });

      return response.data.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      log.error('Instagram メディアの取得に失敗', {
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(`Instagram API エラー: ${axiosError.message}`);
    }
  }

  // Get specific media details
  async getMediaDetails(mediaId: string): Promise<InstagramPost> {
    try {
      const url = ENDPOINTS.instagram.mediaDetails(mediaId);
      const params = {
        fields: 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count',
        access_token: this.accessToken,
      };

      log.debug('Instagram メディア詳細を取得中', { mediaId });

      const response = await axios.get<InstagramPost>(url, { params });

      log.info('Instagram メディア詳細の取得完了', { mediaId });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      log.error('Instagram メディア詳細の取得に失敗', {
        mediaId,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      });
      throw new Error(`Instagram API エラー: ${axiosError.message}`);
    }
  }

  // Verify webhook signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac('sha256', appConfig.instagram.appSecret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );

      log.debug('Webhook 署名検証', { isValid });

      return isValid;
    } catch (error) {
      log.error('Webhook 署名検証に失敗', { error });
      return false;
    }
  }

  // Verify webhook challenge
  verifyWebhookChallenge(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.webhookVerifyToken) {
      log.info('Webhook 認証に成功');
      return challenge;
    }

    log.warn('Webhook 認証に失敗', { mode, token });
    return null;
  }

  // Process webhook payload
  async processWebhookPayload(payload: InstagramWebhookPayload): Promise<InstagramPost[]> {
    const newPosts: InstagramPost[] = [];

    try {
      log.info('Webhook ペイロードを処理中', {
        object: payload.object,
        entriesCount: payload.entry.length,
      });

      for (const entry of payload.entry) {
        const processedPosts = await this.processWebhookEntry(entry);
        newPosts.push(...processedPosts);
      }

      log.info('Webhook ペイロードの処理完了', { newPostsCount: newPosts.length });

      return newPosts;
    } catch (error) {
      log.error('Webhook ペイロードの処理に失敗', { error, payload });
      throw error;
    }
  }

  private async processWebhookEntry(entry: InstagramWebhookEntry): Promise<InstagramPost[]> {
    const newPosts: InstagramPost[] = [];

    for (const change of entry.changes) {
      if (change.field === 'media' && change.value?.verb === 'add' && change.value?.media_id) {
        try {
          const post = await this.getMediaDetails(change.value.media_id);
          newPosts.push(post);
          
          log.info('Webhook で新しい Instagram 投稿を検出', {
            mediaId: change.value.media_id,
            hasCaption: !!post.caption,
          });
        } catch (error) {
          log.error('Webhook からのメディア詳細取得に失敗', {
            mediaId: change.value.media_id,
            error,
          });
        }
      }
    }

    return newPosts;
  }

  // Test API connection
  async testConnection(): Promise<{ success: boolean; message: string; data?: object }> {
    try {
      const posts = await this.getRecentMedia(1);
      
      return {
        success: true,
        message: 'Instagram API 接続成功',
        data: {
          businessAccountId: this.businessAccountId,
          postsCount: posts.length,
          latestPost: posts[0] ? {
            id: posts[0].id,
            timestamp: posts[0].timestamp,
            hasCaption: !!posts[0].caption,
          } : null,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Instagram API 接続に失敗: ${(error as Error).message}`,
      };
    }
  }

  // Extract hashtags from caption
  extractHashtags(caption?: string): string[] {
    if (!caption) return [];

    const hashtagRegex = /#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi;
    const matches = caption.match(hashtagRegex);
    
    return matches || [];
  }

  // Check if post is recent (within last hour by default)
  isRecentPost(timestamp: string, withinMinutes = 60): boolean {
    const postTime = new Date(timestamp);
    const now = new Date();
    const diffMinutes = (now.getTime() - postTime.getTime()) / (1000 * 60);
    
    return diffMinutes <= withinMinutes;
  }
}

export const instagramAPI = new InstagramAPI();