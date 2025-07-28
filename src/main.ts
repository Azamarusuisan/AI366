#!/usr/bin/env node

import { Command } from 'commander';
import cron from 'node-cron';
import { promises as fs } from 'fs';
import path from 'path';
import { appConfig, validateConfig } from './config';
import { log, syncLogger } from './logger';
import { instagramAPI } from './instagram';
import { gbpAPI } from './gbp';
import { postFilter } from './filters';
import { startServer, processSinglePost } from './server';
import { PollState, InstagramPost } from './types';

const POLL_STATE_FILE = path.join(process.cwd(), '.meo-sync-state.json');

class MEOSyncCLI {
  private pollState: PollState = {
    lastPollTime: new Date().toISOString(),
    totalProcessed: 0,
    totalSynced: 0,
  };

  constructor() {
    this.loadPollState();
  }

  // Load polling state from file
  private async loadPollState(): Promise<void> {
    try {
      const data = await fs.readFile(POLL_STATE_FILE, 'utf8');
      this.pollState = JSON.parse(data);
      log.debug('Poll state loaded', this.pollState);
    } catch (error) {
      log.info('No existing poll state found, starting fresh');
    }
  }

  // Save polling state to file
  private async savePollState(): Promise<void> {
    try {
      await fs.writeFile(POLL_STATE_FILE, JSON.stringify(this.pollState, null, 2));
      log.debug('Poll state saved', this.pollState);
    } catch (error) {
      log.error('Failed to save poll state', { error });
    }
  }

  // Poll Instagram for new posts
  async poll(options: { dryRun?: boolean; limit?: number } = {}): Promise<void> {
    try {
      log.info('Instagram ポーリングを開始', {
        lastPollTime: this.pollState.lastPollTime,
        dryRun: options.dryRun,
        limit: options.limit,
      });

      // Calculate time since last poll
      const lastPollDate = new Date(this.pollState.lastPollTime);
      const minutesSinceLastPoll = (Date.now() - lastPollDate.getTime()) / (1000 * 60);

      // Get recent posts since last poll
      const limit = options.limit || appConfig.sync.maxPostsPerPoll;
      const posts = await instagramAPI.getRecentMedia(limit);

      if (posts.length === 0) {
        log.info('ポーリング中に投稿が見つかりませんでした');
        return;
      }

      // Filter posts that are newer than last poll
      const newPosts = posts.filter(post => {
        const postDate = new Date(post.timestamp);
        return postDate > lastPollDate;
      });

      if (newPosts.length === 0) {
        log.info('前回のポーリング以降、新しい投稿はありません', {
          totalPosts: posts.length,
          minutesSinceLastPoll: Math.round(minutesSinceLastPoll),
        });
        return;
      }

      log.info('ポーリングで新しい投稿を発見', {
        totalPosts: posts.length,
        newPosts: newPosts.length,
        minutesSinceLastPoll: Math.round(minutesSinceLastPoll),
      });

      // Filter and process posts
      const { toSync, filtered } = postFilter.filterPosts(newPosts);

      log.info('投稿をフィルタリング完了', {
        newPosts: newPosts.length,
        toSync: toSync.length,
        filtered: filtered.length,
      });

      if (options.dryRun) {
        log.info('ドライラン - 同期対象の投稿', {
          posts: toSync.map(post => ({
            id: post.id,
            timestamp: post.timestamp,
            caption: post.caption?.substring(0, 50) + '...',
          })),
        });
        return;
      }

      // Process posts for synchronization
      let syncedCount = 0;
      for (const post of toSync) {
        try {
          await processSinglePost(post);
          syncedCount++;
        } catch (error) {
          log.error('ポーリング中の投稿処理に失敗', {
            postId: post.id,
            error,
          });
        }
      }

      // Update poll state
      this.pollState = {
        lastPollTime: new Date().toISOString(),
        lastProcessedPostId: newPosts[0]?.id,
        totalProcessed: this.pollState.totalProcessed + newPosts.length,
        totalSynced: this.pollState.totalSynced + syncedCount,
      };

      await this.savePollState();

      log.info('ポーリング完了', {
        processed: newPosts.length,
        synced: syncedCount,
        totalProcessed: this.pollState.totalProcessed,
        totalSynced: this.pollState.totalSynced,
      });

    } catch (error) {
      log.error('ポーリングに失敗', { error });
      throw error;
    }
  }

  // Start scheduled polling with cron
  async startScheduledPolling(): Promise<void> {
    const cronExpression = `*/${appConfig.sync.pollIntervalMinutes} * * * *`;
    
    log.info('定期ポーリングを開始', {
      interval: appConfig.sync.pollIntervalMinutes,
      cronExpression,
    });

    cron.schedule(cronExpression, async () => {
      try {
        await this.poll();
      } catch (error) {
        log.error('定期ポーリングに失敗', { error });
      }
    });

    log.info('定期ポーリングが開始されました - Ctrl+C で停止');
    
    // Keep the process alive
    process.on('SIGINT', () => {
      log.info('定期ポーリングを停止中');
      process.exit(0);
    });

    // Wait indefinitely
    await new Promise(() => {});
  }

  // Test Instagram connection
  async testInstagram(): Promise<void> {
    log.info('Instagram 接続をテスト中...');
    
    try {
      const result = await instagramAPI.testConnection();
      
      if (result.success) {
        console.log(`✅ Instagram 接続成功`);
        console.log(`   ビジネスアカウント ID: ${(result.data as any)?.businessAccountId}`);
        console.log(`   利用可能な投稿数: ${(result.data as any)?.postsCount}`);
        if ((result.data as any)?.latestPost) {
          console.log(`   最新投稿: ${(result.data as any).latestPost.id} (${(result.data as any).latestPost.timestamp})`);
        }
      } else {
        console.log(`❌ Instagram 接続失敗: ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.log(`❌ Instagram 接続失敗: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  // Test GBP connection
  async testGBP(): Promise<void> {
    log.info('Google Business Profile 接続をテスト中...');
    
    try {
      const result = await gbpAPI.testConnection();
      
      if (result.success) {
        console.log(`✅ GBP 接続成功`);
        console.log(`   アカウント ID: ${(result.data as any)?.accountId}`);
        console.log(`   ロケーション ID: ${(result.data as any)?.locationId}`);
        console.log(`   トークン有効: ${(result.data as any)?.tokenValid}`);
      } else {
        console.log(`❌ GBP 接続失敗: ${result.message}`);
        process.exit(1);
      }
    } catch (error) {
      console.log(`❌ GBP 接続失敗: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  // Show recent logs
  async showLogs(options: { limit?: number; page?: number } = {}): Promise<void> {
    try {
      const limit = options.limit || 20;
      const offset = ((options.page || 1) - 1) * limit;
      
      const logs = await syncLogger.getSyncLogs(limit, offset);
      const stats = await syncLogger.getSyncLogStats();

      console.log('\n📊 同期統計:');
      console.log(`   合計: ${stats.total} | 成功: ${stats.successful} | 失敗: ${stats.failed} | スキップ: ${stats.skipped}`);
      if (stats.lastSync) {
        console.log(`   最終同期: ${new Date(stats.lastSync).toLocaleString()}`);
      }

      if (logs.length === 0) {
        console.log('\n📝 同期ログが見つかりません');
        return;
      }

      console.log(`\n📝 最近の同期ログ (${logs.length}件表示):`);
      console.log(''.padEnd(120, '-'));

      for (const log of logs) {
        const status = log.status === 'success' ? '✅' : log.status === 'failed' ? '❌' : '⏭️';
        const timestamp = new Date(log.timestamp).toLocaleString();
        const duration = `${log.syncDuration}ms`;
        
        console.log(`${status} ${timestamp} | ${log.instagramPostId} | ${duration}`);
        
        if (log.instagramCaption) {
          const caption = log.instagramCaption.substring(0, 80);
          console.log(`   キャプション: ${caption}${log.instagramCaption.length > 80 ? '...' : ''}`);
        }
        
        if (log.gbpPostId) {
          console.log(`   GBP 投稿: ${log.gbpPostId}`);
        }
        
        if (log.error) {
          console.log(`   エラー: ${log.error}`);
        }
        
        if (log.hashtags.length > 0) {
          console.log(`   ハッシュタグ: ${log.hashtags.join(', ')}`);
        }
        
        console.log('');
      }

    } catch (error) {
      console.log(`❌ ログの取得に失敗: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  // Show current status
  async showStatus(): Promise<void> {
    try {
      console.log('\n🔄 MEO Sync ステータス');
      console.log(''.padEnd(50, '='));

      // Configuration
      console.log('\n⚙️  設定:');
      console.log(`   対象ハッシュタグ: ${appConfig.sync.targetHashtag}`);
      console.log(`   ポーリング間隔: ${appConfig.sync.pollIntervalMinutes} 分`);
      console.log(`   1回あたりの最大投稿数: ${appConfig.sync.maxPostsPerPoll}`);
      console.log(`   環境: ${appConfig.env}`);

      // Poll state
      console.log('\n📊 ポーリング状態:');
      console.log(`   最終ポーリング: ${new Date(this.pollState.lastPollTime).toLocaleString()}`);
      console.log(`   総処理数: ${this.pollState.totalProcessed}`);
      console.log(`   総同期数: ${this.pollState.totalSynced}`);
      if (this.pollState.lastProcessedPostId) {
        console.log(`   最終処理投稿: ${this.pollState.lastProcessedPostId}`);
      }

      // Recent stats
      const stats = await syncLogger.getSyncLogStats();
      console.log('\n📈 最近の同期統計:');
      console.log(`   成功: ${stats.successful} | 失敗: ${stats.failed} | スキップ: ${stats.skipped}`);
      if (stats.lastSync) {
        const lastSyncDate = new Date(stats.lastSync);
        const minutesAgo = Math.round((Date.now() - lastSyncDate.getTime()) / (1000 * 60));
        console.log(`   最終同期: ${minutesAgo} 分前`);
      }

      // Connection status
      console.log('\n🔗 接続状態:');
      
      try {
        const igResult = await instagramAPI.testConnection();
        console.log(`   Instagram: ${igResult.success ? '✅ 接続中' : '❌ 失敗'}`);
      } catch {
        console.log(`   Instagram: ❌ 失敗`);
      }

      try {
        const gbpResult = await gbpAPI.testConnection();
        console.log(`   Google Business Profile: ${gbpResult.success ? '✅ 接続中' : '❌ 失敗'}`);
      } catch {
        console.log(`   Google Business Profile: ❌ 失敗`);
      }

    } catch (error) {
      console.log(`❌ ステータスの取得に失敗: ${(error as Error).message}`);
      process.exit(1);
    }
  }
}

// CLI Program setup
const program = new Command();
const cli = new MEOSyncCLI();

program
  .name('meo-sync')
  .description('Instagram から Google Business Profile への同期ツール')
  .version('1.0.0');

program
  .command('poll')
  .description('Instagram の新しい投稿をポーリングして GBP に同期')
  .option('--dry-run', '実際の同期を行わずに同期対象を表示')
  .option('--limit <number>', 'チェックする投稿数の上限', '25')
  .action(async (options) => {
    try {
      validateConfig();
      await syncLogger.init();
      await cli.poll({
        dryRun: options.dryRun,
        limit: parseInt(options.limit),
      });
    } catch (error) {
      console.error('ポーリングに失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('start-polling')
  .description('定期ポーリングを開始（連続実行）')
  .action(async () => {
    try {
      validateConfig();
      await syncLogger.init();
      await cli.startScheduledPolling();
    } catch (error) {
      console.error('定期ポーリングに失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Webhook サーバーを開始')
  .action(async () => {
    try {
      await startServer();
    } catch (error) {
      console.error('サーバー起動に失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('test-instagram')
  .description('Instagram API 接続をテスト')
  .action(async () => {
    try {
      validateConfig();
      await cli.testInstagram();
    } catch (error) {
      console.error('テストに失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('test-gbp')
  .description('Google Business Profile API 接続をテスト')
  .action(async () => {
    try {
      validateConfig();
      await cli.testGBP();
    } catch (error) {
      console.error('テストに失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('logs')
  .description('最近の同期ログを表示')
  .option('--limit <number>', '表示するログ数', '20')
  .option('--page <number>', 'ページ番号', '1')
  .action(async (options) => {
    try {
      await syncLogger.init();
      await cli.showLogs({
        limit: parseInt(options.limit),
        page: parseInt(options.page),
      });
    } catch (error) {
      console.error('ログ表示に失敗:', (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('現在のステータスと設定を表示')
  .action(async () => {
    try {
      validateConfig();
      await syncLogger.init();
      await cli.showStatus();
    } catch (error) {
      console.error('ステータス表示に失敗:', (error as Error).message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no command provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}