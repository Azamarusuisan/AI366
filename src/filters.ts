import { appConfig } from './config';
import { log } from './logger';
import { InstagramPost, FilterResult } from './types';

export class PostFilter {
  private readonly targetHashtag: string;

  constructor() {
    this.targetHashtag = appConfig.sync.targetHashtag.toLowerCase();
  }

  // Main filter method to determine if a post should be synced
  filterPost(post: InstagramPost): FilterResult {
    log.debug('Instagram 投稿をフィルタリング中', {
      postId: post.id,
      hasCaption: !!post.caption,
      timestamp: post.timestamp,
    });

    // Extract hashtags from caption
    const hashtags = this.extractHashtags(post.caption);
    const normalizedHashtags = hashtags.map(tag => tag.toLowerCase());

    // Check if target hashtag is present
    const hasTargetHashtag = normalizedHashtags.includes(this.targetHashtag);

    if (!hasTargetHashtag) {
      log.debug('投稿を除外 - 対象ハッシュタグが見つかりません', {
        postId: post.id,
        targetHashtag: this.targetHashtag,
        foundHashtags: hashtags,
      });

      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: `対象ハッシュタグ '${appConfig.sync.targetHashtag}' が投稿に見つかりません`,
      };
    }

    // Additional filters can be added here
    const additionalFilters = [
      this.filterByMediaType(post),
      this.filterByAge(post),
      this.filterByContent(post),
    ];

    for (const filter of additionalFilters) {
      if (!filter.shouldSync) {
        log.debug('追加フィルターにより投稿を除外', {
          postId: post.id,
          reason: filter.reason,
        });
        return filter;
      }
    }

    log.info('投稿がすべてのフィルターを通過', {
      postId: post.id,
      matchedHashtags: hashtags.filter(tag => 
        normalizedHashtags.includes(this.targetHashtag)
      ),
    });

    return {
      shouldSync: true,
      matchedHashtags: hashtags,
    };
  }

  // Extract hashtags from text
  private extractHashtags(text?: string): string[] {
    if (!text) return [];

    const hashtagRegex = /#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi;
    const matches = text.match(hashtagRegex);
    
    return matches || [];
  }

  // Filter by media type (allow images and carousels, skip videos for now)
  private filterByMediaType(post: InstagramPost): FilterResult {
    const allowedTypes = ['IMAGE', 'CAROUSEL_ALBUM'];
    
    if (!allowedTypes.includes(post.media_type)) {
      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: `メディアタイプ '${post.media_type}' はサポートされていません`,
      };
    }

    return { shouldSync: true, matchedHashtags: [] };
  }

  // Filter by post age (skip posts older than 24 hours)
  private filterByAge(post: InstagramPost, maxAgeHours = 24): FilterResult {
    const postDate = new Date(post.timestamp);
    const now = new Date();
    const ageHours = (now.getTime() - postDate.getTime()) / (1000 * 60 * 60);

    if (ageHours > maxAgeHours) {
      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: `投稿が古すぎます (${Math.round(ageHours)}時間前, 最大: ${maxAgeHours}時間)`,
      };
    }

    return { shouldSync: true, matchedHashtags: [] };
  }

  // Filter by content (basic content validation)
  private filterByContent(post: InstagramPost): FilterResult {
    // Skip posts without captions (since we need hashtags)
    if (!post.caption || post.caption.trim().length === 0) {
      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: '投稿にキャプションがありません',
      };
    }

    // Skip very short captions (less than 10 characters after cleaning)
    const cleanedCaption = post.caption.replace(/#[\w\u00c0-\u024f\u1e00-\u1eff]+/gi, '').trim();
    if (cleanedCaption.length < 10) {
      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: 'ハッシュタグを除いたキャプションが短すぎます',
      };
    }

    // Basic spam detection (too many hashtags)
    const hashtags = this.extractHashtags(post.caption);
    if (hashtags.length > 20) {
      return {
        shouldSync: false,
        matchedHashtags: [],
        reason: `ハッシュタグが多すぎます (${hashtags.length}個, 最大: 20個)`,
      };
    }

    // Content quality filters could be added here
    // e.g., keyword filtering, sentiment analysis, etc.

    return { shouldSync: true, matchedHashtags: [] };
  }

  // Batch filter multiple posts
  filterPosts(posts: InstagramPost[]): {
    toSync: InstagramPost[];
    filtered: Array<{ post: InstagramPost; reason: string }>;
  } {
    const toSync: InstagramPost[] = [];
    const filtered: Array<{ post: InstagramPost; reason: string }> = [];

    for (const post of posts) {
      const result = this.filterPost(post);
      
      if (result.shouldSync) {
        toSync.push(post);
      } else {
        filtered.push({
          post,
          reason: result.reason || 'Unknown reason',
        });
      }
    }

    log.info('バッチフィルタリング完了', {
      totalPosts: posts.length,
      toSync: toSync.length,
      filtered: filtered.length,
    });

    return { toSync, filtered };
  }

  // Get filter statistics
  getFilterStats(): {
    targetHashtag: string;
    allowedMediaTypes: string[];
    maxPostAgeHours: number;
    minCaptionLength: number;
    maxHashtagCount: number;
  } {
    return {
      targetHashtag: appConfig.sync.targetHashtag,
      allowedMediaTypes: ['IMAGE', 'CAROUSEL_ALBUM'],
      maxPostAgeHours: 24,
      minCaptionLength: 10,
      maxHashtagCount: 20,
    };
  }

  // Update target hashtag (for dynamic configuration)
  updateTargetHashtag(newHashtag: string): void {
    if (!newHashtag.startsWith('#')) {
      throw new Error('ハッシュタグは # で始まる必要があります');
    }

    const oldHashtag = this.targetHashtag;
    // 注意: これはインスタンスのみを更新し、設定は更新しません
    (this as any).targetHashtag = newHashtag.toLowerCase();

    log.info('対象ハッシュタグを更新', {
      oldHashtag,
      newHashtag: newHashtag.toLowerCase(),
    });
  }
}

export const postFilter = new PostFilter();