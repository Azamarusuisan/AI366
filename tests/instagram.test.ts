import axios from 'axios';
import { InstagramAPI } from '../src/instagram';
import { InstagramPost, InstagramWebhookPayload } from '../src/types';

jest.mock('axios');
jest.mock('../src/config');
jest.mock('../src/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('InstagramAPI', () => {
  let api: InstagramAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new InstagramAPI();
  });

  describe('getRecentMedia', () => {
    const mockPosts: InstagramPost[] = [
      {
        id: 'post-1',
        caption: 'Test post 1',
        media_type: 'IMAGE',
        permalink: 'https://instagram.com/p/1',
        timestamp: '2023-01-01T00:00:00Z',
      },
      {
        id: 'post-2',
        caption: 'Test post 2',
        media_type: 'VIDEO',
        permalink: 'https://instagram.com/p/2',
        timestamp: '2023-01-01T01:00:00Z',
      },
    ];

    it('should fetch recent media successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          data: mockPosts,
          paging: {},
        },
      });

      const result = await api.getRecentMedia(10);

      expect(result).toEqual(mockPosts);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/media'),
        expect.objectContaining({
          params: expect.objectContaining({
            limit: '10',
            fields: expect.stringContaining('id,caption'),
          }),
        })
      );
    });

    it('should include since parameter when provided', async () => {
      mockedAxios.get.mockResolvedValue({
        data: { data: [], paging: {} },
      });

      await api.getRecentMedia(10, '2023-01-01');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            since: '2023-01-01',
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API Error'));

      await expect(api.getRecentMedia()).rejects.toThrow('Instagram API error: API Error');
    });
  });

  describe('getMediaDetails', () => {
    const mockPost: InstagramPost = {
      id: 'post-1',
      caption: 'Test post',
      media_type: 'IMAGE',
      permalink: 'https://instagram.com/p/1',
      timestamp: '2023-01-01T00:00:00Z',
    };

    it('should fetch media details successfully', async () => {
      mockedAxios.get.mockResolvedValue({
        data: mockPost,
      });

      const result = await api.getMediaDetails('post-1');

      expect(result).toEqual(mockPost);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('post-1'),
        expect.objectContaining({
          params: expect.objectContaining({
            fields: expect.stringContaining('id,caption'),
          }),
        })
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Not Found'));

      await expect(api.getMediaDetails('invalid-id')).rejects.toThrow('Instagram API error: Not Found');
    });
  });

  describe('verifyWebhookSignature', () => {
    it('should verify valid signature', () => {
      // Mock crypto functions for testing
      const crypto = require('crypto');
      const payload = 'test payload';
      const secret = 'test-secret';
      
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Mock the config to return our test secret
      jest.doMock('../src/config', () => ({
        appConfig: {
          instagram: {
            appSecret: secret,
          },
        },
      }));

      const result = api.verifyWebhookSignature(payload, `sha256=${expectedSignature}`);
      expect(result).toBe(true);
    });

    it('should reject invalid signature', () => {
      const result = api.verifyWebhookSignature('test payload', 'sha256=invalid-signature');
      expect(result).toBe(false);
    });
  });

  describe('verifyWebhookChallenge', () => {
    it('should return challenge for valid verification', () => {
      // Mock config
      jest.doMock('../src/config', () => ({
        appConfig: {
          instagram: {
            webhookVerifyToken: 'test-token',
          },
        },
      }));

      const result = api.verifyWebhookChallenge('subscribe', 'test-token', 'challenge-123');
      expect(result).toBe('challenge-123');
    });

    it('should return null for invalid verification', () => {
      const result = api.verifyWebhookChallenge('subscribe', 'wrong-token', 'challenge-123');
      expect(result).toBe(null);
    });
  });

  describe('processWebhookPayload', () => {
    const mockPayload: InstagramWebhookPayload = {
      object: 'instagram',
      entry: [
        {
          id: 'account-id',
          time: 1234567890,
          changes: [
            {
              field: 'media',
              value: {
                media_id: 'new-post-id',
                verb: 'add',
              },
            },
          ],
        },
      ],
    };

    it('should process webhook payload and fetch new posts', async () => {
      const mockPost: InstagramPost = {
        id: 'new-post-id',
        caption: 'New post',
        media_type: 'IMAGE',
        permalink: 'https://instagram.com/p/new',
        timestamp: new Date().toISOString(),
      };

      mockedAxios.get.mockResolvedValue({
        data: mockPost,
      });

      const result = await api.processWebhookPayload(mockPayload);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockPost);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('new-post-id'),
        expect.any(Object)
      );
    });

    it('should handle webhook payload with no new posts', async () => {
      const emptyPayload: InstagramWebhookPayload = {
        object: 'instagram',
        entry: [
          {
            id: 'account-id',
            time: 1234567890,
            changes: [
              {
                field: 'comments',
                value: {},
              },
            ],
          },
        ],
      };

      const result = await api.processWebhookPayload(emptyPayload);
      expect(result).toHaveLength(0);
    });
  });

  describe('extractHashtags', () => {
    it('should extract hashtags from caption', () => {
      const caption = 'Check out our new menu! #food #restaurant #MEO #delicious';
      const hashtags = api.extractHashtags(caption);

      expect(hashtags).toEqual(['#food', '#restaurant', '#MEO', '#delicious']);
    });

    it('should handle captions without hashtags', () => {
      const caption = 'Just a regular post without any hashtags';
      const hashtags = api.extractHashtags(caption);

      expect(hashtags).toEqual([]);
    });

    it('should handle undefined caption', () => {
      const hashtags = api.extractHashtags(undefined);
      expect(hashtags).toEqual([]);
    });

    it('should handle unicode characters in hashtags', () => {
      const caption = 'Post with unicode hashtags #カフェ #レストラン';
      const hashtags = api.extractHashtags(caption);

      expect(hashtags).toContain('#カフェ');
      expect(hashtags).toContain('#レストラン');
    });
  });

  describe('isRecentPost', () => {
    it('should identify recent posts', () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
      const isRecent = api.isRecentPost(recentTime.toISOString(), 60);

      expect(isRecent).toBe(true);
    });

    it('should identify old posts', () => {
      const oldTime = new Date(Date.now() - 120 * 60 * 1000); // 2 hours ago
      const isRecent = api.isRecentPost(oldTime.toISOString(), 60);

      expect(isRecent).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      const mockPosts: InstagramPost[] = [
        {
          id: 'test-post',
          caption: 'Test',
          media_type: 'IMAGE',
          permalink: 'https://instagram.com/p/test',
          timestamp: new Date().toISOString(),
        },
      ];

      mockedAxios.get.mockResolvedValue({
        data: { data: mockPosts },
      });

      const result = await api.testConnection();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        postsCount: 1,
        latestPost: expect.objectContaining({
          id: 'test-post',
        }),
      });
    });

    it('should return failure for connection error', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      const result = await api.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });
});