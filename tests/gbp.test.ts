import axios from 'axios';
import { GoogleBusinessProfileAPI } from '../src/gbp';
import { InstagramPost } from '../src/types';

jest.mock('axios');
jest.mock('../src/config');
jest.mock('../src/logger');

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('GoogleBusinessProfileAPI', () => {
  let api: GoogleBusinessProfileAPI;

  beforeEach(() => {
    jest.clearAllMocks();
    api = new GoogleBusinessProfileAPI();
  });

  describe('createLocalPost', () => {
    const mockInstagramPost: InstagramPost = {
      id: 'ig-post-1',
      caption: 'Test post with #MEO hashtag',
      media_type: 'IMAGE',
      media_url: 'https://example.com/image.jpg',
      permalink: 'https://instagram.com/p/test',
      timestamp: '2023-01-01T00:00:00Z',
    };

    it('should create local post successfully', async () => {
      // Mock token refresh
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'new-token',
            expires_in: 3600,
          },
        })
        // Mock post creation
        .mockResolvedValueOnce({
          data: {
            name: 'accounts/123/locations/456/localPosts/789',
            languageCode: 'en-US',
            summary: 'Test post',
            createTime: '2023-01-01T00:00:00Z',
            updateTime: '2023-01-01T00:00:00Z',
            state: 'LIVE',
          },
        });

      const result = await api.createLocalPost(mockInstagramPost);

      expect(result).toBe('accounts/123/locations/456/localPosts/789');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle post creation failure', async () => {
      // Mock token refresh success
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'new-token',
            expires_in: 3600,
          },
        })
        // Mock post creation failure
        .mockRejectedValueOnce(new Error('API Error'));

      await expect(api.createLocalPost(mockInstagramPost)).rejects.toThrow('GBP post creation failed');
    });
  });

  describe('validateLocalPost', () => {
    const mockInstagramPost: InstagramPost = {
      id: 'ig-post-1',
      caption: 'Test validation post',
      media_type: 'IMAGE',
      permalink: 'https://instagram.com/p/test',
      timestamp: '2023-01-01T00:00:00Z',
    };

    it('should validate post successfully', async () => {
      // Mock token refresh
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'new-token',
            expires_in: 3600,
          },
        })
        // Mock validation success
        .mockResolvedValueOnce({ data: {} });

      const result = await api.validateLocalPost(mockInstagramPost);

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should handle validation failure', async () => {
      // Mock token refresh
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'new-token',
            expires_in: 3600,
          },
        })
        // Mock validation failure
        .mockRejectedValueOnce(new Error('Validation failed'));

      const result = await api.validateLocalPost(mockInstagramPost);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation failed');
    });
  });

  describe('testConnection', () => {
    it('should return success for valid connection', async () => {
      // Mock token refresh
      mockedAxios.post
        .mockResolvedValueOnce({
          data: {
            access_token: 'test-token',
            expires_in: 3600,
          },
        })
        // Mock validation call
        .mockResolvedValueOnce({ data: {} });

      const result = await api.testConnection();

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        tokenValid: expect.any(Boolean),
        validationWorking: expect.any(Boolean),
      });
    });

    it('should return failure for connection error', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Connection failed'));

      const result = await api.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });

  describe('getTokenStatus', () => {
    it('should return token status', () => {
      const status = api.getTokenStatus();

      expect(status).toMatchObject({
        hasToken: expect.any(Boolean),
        isExpired: expect.any(Boolean),
      });
    });
  });
});