import winston from 'winston';
import { promises as fs } from 'fs';
import path from 'path';
import { appConfig } from './config';
import { SyncLog } from './types';

// Create logs directory if it doesn't exist
const logsDir = path.dirname(appConfig.logging.filePath || './logs/meo-sync.log');

async function ensureLogsDirectory(): Promise<void> {
  try {
    await fs.access(logsDir);
  } catch {
    await fs.mkdir(logsDir, { recursive: true });
  }
}

// Winston logger configuration
const logger = winston.createLogger({
  level: appConfig.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'meo-sync' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({
      filename: appConfig.logging.filePath || './logs/meo-sync.log',
      maxsize: parseSize(appConfig.logging.maxSize || '10m'),
      maxFiles: appConfig.logging.maxFiles || 7,
    }),
  ],
});

// Parse size string to bytes
function parseSize(size: string): number {
  const units: Record<string, number> = {
    b: 1,
    k: 1024,
    m: 1024 * 1024,
    g: 1024 * 1024 * 1024,
  };
  
  const match = size.toLowerCase().match(/^(\d+)([bkmg]?)$/);
  if (!match) return 10 * 1024 * 1024; // Default 10MB
  
  const [, number, unit = 'b'] = match;
  return parseInt(number, 10) * (units[unit] || 1);
}

// Sync log management
const SYNC_LOG_FILE = path.join(logsDir, 'sync-history.jsonl');

export class SyncLogger {
  private static instance: SyncLogger;

  static getInstance(): SyncLogger {
    if (!SyncLogger.instance) {
      SyncLogger.instance = new SyncLogger();
    }
    return SyncLogger.instance;
  }

  async init(): Promise<void> {
    await ensureLogsDirectory();
  }

  async logSync(syncLog: SyncLog): Promise<void> {
    try {
      const logEntry = JSON.stringify(syncLog) + '\n';
      await fs.appendFile(SYNC_LOG_FILE, logEntry, 'utf8');
      
      logger.info('Sync operation logged', {
        syncId: syncLog.id,
        status: syncLog.status,
        instagramPostId: syncLog.instagramPostId,
        gbpPostId: syncLog.gbpPostId,
      });
    } catch (error) {
      logger.error('Failed to write sync log', { error, syncLog });
    }
  }

  async getSyncLogs(limit = 50, offset = 0): Promise<SyncLog[]> {
    try {
      await fs.access(SYNC_LOG_FILE);
      const data = await fs.readFile(SYNC_LOG_FILE, 'utf8');
      
      const logs = data
        .trim()
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line) as SyncLog;
          } catch {
            return null;
          }
        })
        .filter((log): log is SyncLog => log !== null)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(offset, offset + limit);

      return logs;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      logger.error('Failed to read sync logs', { error });
      throw error;
    }
  }

  async getSyncLogStats(): Promise<{
    total: number;
    successful: number;
    failed: number;
    skipped: number;
    lastSync?: string;
  }> {
    try {
      const logs = await this.getSyncLogs(1000); // Get recent logs for stats
      
      const stats = {
        total: logs.length,
        successful: logs.filter(log => log.status === 'success').length,
        failed: logs.filter(log => log.status === 'failed').length,
        skipped: logs.filter(log => log.status === 'skipped').length,
        lastSync: logs.length > 0 ? logs[0].timestamp : undefined,
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get sync log stats', { error });
      return {
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
      };
    }
  }

  async clearOldLogs(daysToKeep = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const logs = await this.getSyncLogs(10000);
      const recentLogs = logs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );

      if (recentLogs.length < logs.length) {
        const newContent = recentLogs
          .map(log => JSON.stringify(log))
          .join('\n') + (recentLogs.length > 0 ? '\n' : '');
        
        await fs.writeFile(SYNC_LOG_FILE, newContent, 'utf8');
        
        logger.info('Cleaned old sync logs', {
          removed: logs.length - recentLogs.length,
          remaining: recentLogs.length,
        });
      }
    } catch (error) {
      logger.error('Failed to clear old logs', { error });
    }
  }
}

// Application logger methods
export const log = {
  debug: (message: string, meta?: object): void => { logger.debug(message, meta); },
  info: (message: string, meta?: object): void => { logger.info(message, meta); },
  warn: (message: string, meta?: object): void => { logger.warn(message, meta); },
  error: (message: string, meta?: object): void => { logger.error(message, meta); },
};

// Initialize sync logger
export const syncLogger = SyncLogger.getInstance();

export default logger;