import { config } from 'dotenv';
import { AppConfig } from './types';

// Load environment variables
config();

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`環境変数 ${key} が必要ですが設定されていません`);
  }
  return value || defaultValue!;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`環境変数 ${key} は有効な数値である必要があります`);
  }
  return parsed;
}

export const appConfig: AppConfig = {
  instagram: {
    appId: getEnvVar('INSTAGRAM_APP_ID'),
    appSecret: getEnvVar('INSTAGRAM_APP_SECRET'),
    accessToken: getEnvVar('INSTAGRAM_ACCESS_TOKEN'),
    businessAccountId: getEnvVar('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
    webhookVerifyToken: getEnvVar('INSTAGRAM_WEBHOOK_VERIFY_TOKEN'),
  },
  gbp: {
    clientId: getEnvVar('GBP_CLIENT_ID'),
    clientSecret: getEnvVar('GBP_CLIENT_SECRET'),
    refreshToken: getEnvVar('GBP_REFRESH_TOKEN'),
    accountId: getEnvVar('GBP_ACCOUNT_ID'),
    locationId: getEnvVar('GBP_LOCATION_ID'),
  },
  server: {
    port: getEnvNumber('PORT', 3000),
    webhookPath: getEnvVar('WEBHOOK_PATH', '/webhook/instagram'),
    apiBasePath: getEnvVar('API_BASE_PATH', '/api'),
  },
  sync: {
    targetHashtag: getEnvVar('TARGET_HASHTAG', '#MEO'),
    pollIntervalMinutes: getEnvNumber('POLL_INTERVAL_MINUTES', 5),
    maxPostsPerPoll: getEnvNumber('MAX_POSTS_PER_POLL', 10),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
    filePath: getEnvVar('LOG_FILE_PATH', './logs/meo-sync.log'),
    maxFiles: getEnvNumber('LOG_MAX_FILES', 7),
    maxSize: getEnvVar('LOG_MAX_SIZE', '10m'),
  },
  env: getEnvVar('NODE_ENV', 'development'),
};

// Validation
export function validateConfig(): void {
  const required = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'INSTAGRAM_ACCESS_TOKEN',
    'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    'INSTAGRAM_WEBHOOK_VERIFY_TOKEN',
    'GBP_CLIENT_ID',
    'GBP_CLIENT_SECRET',
    'GBP_REFRESH_TOKEN',
    'GBP_ACCOUNT_ID',
    'GBP_LOCATION_ID',
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `必要な環境変数が不足しています: ${missing.join(', ')}\n` +
      '.envファイルまたは環境設定を確認してください。'
    );
  }

  // ハッシュタグ形式の検証
  if (!appConfig.sync.targetHashtag.startsWith('#')) {
    throw new Error('TARGET_HASHTAG は # で始まる必要があります');
  }

  // 数値の検証
  if (appConfig.server.port < 1 || appConfig.server.port > 65535) {
    throw new Error('PORT は 1 から 65535 の間である必要があります');
  }

  if (appConfig.sync.pollIntervalMinutes < 1) {
    throw new Error('POLL_INTERVAL_MINUTES は 1 以上である必要があります');
  }

  if (appConfig.sync.maxPostsPerPoll < 1) {
    throw new Error('MAX_POSTS_PER_POLL は 1 以上である必要があります');
  }
}

// Constants
export const INSTAGRAM_API_BASE = 'https://graph.facebook.com/v18.0';
export const GBP_API_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
export const GBP_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// API Endpoints
export const ENDPOINTS = {
  instagram: {
    media: (businessAccountId: string) => 
      `${INSTAGRAM_API_BASE}/${businessAccountId}/media`,
    mediaDetails: (mediaId: string) => 
      `${INSTAGRAM_API_BASE}/${mediaId}`,
  },
  gbp: {
    createPost: (accountId: string, locationId: string) =>
      `${GBP_API_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`,
    refreshToken: GBP_TOKEN_URL,
  },
} as const;

export default appConfig;