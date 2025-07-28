import { SyncLogger } from '../src/logger';
import { SyncLog } from '../src/types';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    mkdir: jest.fn(),
    appendFile: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

jest.mock('../src/config');

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('SyncLogger', () => {
  let logger: SyncLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = SyncLogger.getInstance();
  });

  describe('logSync', () => {
    const mockSyncLog: SyncLog = {
      id: 'test-sync-1',
      timestamp: '2023-01-01T00:00:00Z',
      instagramPostId: 'ig-post-1',
      instagramCaption: 'Test post',
      status: 'success',
      hashtags: ['#MEO'],
      syncDuration: 1500,
    };

    it('should log sync successfully', async () => {
      mockedFs.appendFile.mockResolvedValue(undefined);

      await logger.logSync(mockSyncLog);

      expect(mockedFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('sync-history.jsonl'),
        JSON.stringify(mockSyncLog) + '\n',
        'utf8'
      );
    });

    it('should handle logging errors gracefully', async () => {
      mockedFs.appendFile.mockRejectedValue(new Error('Write failed'));

      // Should not throw
      await expect(logger.logSync(mockSyncLog)).resolves.toBeUndefined();
    });
  });

  describe('getSyncLogs', () => {
    const mockLogData = [
      {
        id: 'sync-1',
        timestamp: '2023-01-01T01:00:00Z',
        instagramPostId: 'post-1',
        status: 'success',
        hashtags: ['#MEO'],
        syncDuration: 1000,
      },
      {
        id: 'sync-2',
        timestamp: '2023-01-01T00:00:00Z',
        instagramPostId: 'post-2',
        status: 'failed',
        hashtags: [],
        syncDuration: 500,
      },
    ];

    it('should read and parse sync logs', async () => {
      const logFileContent = mockLogData.map(log => JSON.stringify(log)).join('\n');
      mockedFs.readFile.mockResolvedValue(logFileContent);

      const logs = await logger.getSyncLogs(10, 0);

      expect(logs).toHaveLength(2);
      expect(logs[0].id).toBe('sync-1'); // Should be sorted by timestamp desc
      expect(logs[1].id).toBe('sync-2');
    });

    it('should return empty array when file does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedFs.readFile.mockRejectedValue(error);

      const logs = await logger.getSyncLogs();

      expect(logs).toEqual([]);
    });

    it('should handle pagination correctly', async () => {
      const logFileContent = mockLogData.map(log => JSON.stringify(log)).join('\n');
      mockedFs.readFile.mockResolvedValue(logFileContent);

      const logs = await logger.getSyncLogs(1, 1);

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('sync-2');
    });

    it('should handle malformed JSON gracefully', async () => {
      const logFileContent = JSON.stringify(mockLogData[0]) + '\n' + 'invalid-json' + '\n';
      mockedFs.readFile.mockResolvedValue(logFileContent);

      const logs = await logger.getSyncLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe('sync-1');
    });
  });

  describe('getSyncLogStats', () => {
    const mockLogData = [
      {
        id: 'sync-1',
        timestamp: '2023-01-01T01:00:00Z',
        instagramPostId: 'post-1',
        status: 'success',
        hashtags: ['#MEO'],
        syncDuration: 1000,
      },
      {
        id: 'sync-2',
        timestamp: '2023-01-01T00:30:00Z',
        instagramPostId: 'post-2',
        status: 'failed',
        hashtags: [],
        syncDuration: 500,
      },
      {
        id: 'sync-3',
        timestamp: '2023-01-01T00:00:00Z',
        instagramPostId: 'post-3',
        status: 'skipped',
        hashtags: [],
        syncDuration: 100,
      },
    ];

    it('should calculate sync statistics correctly', async () => {
      const logFileContent = mockLogData.map(log => JSON.stringify(log)).join('\n');
      mockedFs.readFile.mockResolvedValue(logFileContent);

      const stats = await logger.getSyncLogStats();

      expect(stats).toEqual({
        total: 3,
        successful: 1,
        failed: 1,
        skipped: 1,
        lastSync: '2023-01-01T01:00:00Z',
      });
    });

    it('should handle empty log file', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      mockedFs.readFile.mockRejectedValue(error);

      const stats = await logger.getSyncLogStats();

      expect(stats).toEqual({
        total: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
      });
    });
  });

  describe('clearOldLogs', () => {
    it('should remove old logs and keep recent ones', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 35); // 35 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      const mockLogData = [
        {
          id: 'recent-sync',
          timestamp: recentDate.toISOString(),
          instagramPostId: 'recent-post',
          status: 'success',
          hashtags: ['#MEO'],
          syncDuration: 1000,
        },
        {
          id: 'old-sync',
          timestamp: oldDate.toISOString(),
          instagramPostId: 'old-post',
          status: 'success',
          hashtags: ['#MEO'],
          syncDuration: 1000,
        },
      ];

      const logFileContent = mockLogData.map(log => JSON.stringify(log)).join('\n');
      mockedFs.readFile.mockResolvedValue(logFileContent);
      mockedFs.writeFile.mockResolvedValue(undefined);

      await logger.clearOldLogs(30);

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('sync-history.jsonl'),
        expect.stringContaining('recent-sync'),
        'utf8'
      );

      const writtenContent = (mockedFs.writeFile as jest.Mock).mock.calls[0][1];
      expect(writtenContent).not.toContain('old-sync');
    });
  });
});