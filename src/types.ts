// Instagram Graph API Types
export interface InstagramPost {
  id: string;
  caption?: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export interface InstagramMediaResponse {
  data: InstagramPost[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
    previous?: string;
  };
}

export interface InstagramWebhookEntry {
  id: string;
  time: number;
  changes: Array<{
    field: string;
    value: {
      media_id?: string;
      verb?: 'add' | 'edit' | 'delete';
    };
  }>;
}

export interface InstagramWebhookPayload {
  object: string;
  entry: InstagramWebhookEntry[];
}

// Google Business Profile API Types
export interface GBPLocalPost {
  languageCode: string;
  summary: string;
  media?: Array<{
    mediaFormat: 'PHOTO';
    sourceUrl: string;
  }>;
  topicType: 'STANDARD' | 'EVENT' | 'OFFER';
  callToAction?: {
    actionType: 'LEARN_MORE' | 'CALL' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP';
    url?: string;
  };
}

export interface GBPCreatePostRequest {
  localPost: GBPLocalPost;
  validateOnly?: boolean;
}

export interface GBPCreatePostResponse {
  name: string;
  languageCode: string;
  summary: string;
  createTime: string;
  updateTime: string;
  state: 'LIVE' | 'REJECTED';
}

export interface GBPTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

// Internal Application Types
export interface SyncLog {
  id: string;
  timestamp: string;
  instagramPostId: string;
  instagramCaption?: string;
  instagramMediaUrl?: string;
  gbpPostId?: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  hashtags: string[];
  syncDuration: number;
}

export interface FilterResult {
  shouldSync: boolean;
  matchedHashtags: string[];
  reason?: string;
}

export interface AppConfig {
  instagram: {
    appId: string;
    appSecret: string;
    accessToken: string;
    businessAccountId: string;
    webhookVerifyToken: string;
  };
  gbp: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accountId: string;
    locationId: string;
  };
  server: {
    port: number;
    webhookPath: string;
    apiBasePath: string;
  };
  sync: {
    targetHashtag: string;
    pollIntervalMinutes: number;
    maxPostsPerPoll: number;
  };
  logging: {
    level: string;
    filePath: string;
    maxFiles: number;
    maxSize: string;
  };
  env: string;
}

export interface PollState {
  lastPollTime: string;
  lastProcessedPostId?: string;
  totalProcessed: number;
  totalSynced: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LogsApiResponse extends ApiResponse {
  data?: {
    logs: SyncLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

// CLI Command Types
export type CliCommand = 'poll' | 'server' | 'test-instagram' | 'test-gbp' | 'logs';

export interface CliOptions {
  command: CliCommand;
  verbose?: boolean;
  dryRun?: boolean;
  limit?: number;
  page?: number;
}