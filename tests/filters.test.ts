import { PostFilter } from '../src/filters';
import { InstagramPost } from '../src/types';

describe('PostFilter', () => {
  let filter: PostFilter;

  beforeEach(() => {
    // Mock config
    jest.mock('../src/config', () => ({
      appConfig: {
        sync: {
          targetHashtag: '#MEO'
        }
      }
    }));
    
    filter = new PostFilter();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('filterPost', () => {
    const createMockPost = (overrides: Partial<InstagramPost> = {}): InstagramPost => ({
      id: 'test-post-1',
      caption: 'Test post with #MEO hashtag',
      media_type: 'IMAGE',
      permalink: 'https://instagram.com/p/test',
      timestamp: new Date().toISOString(),
      ...overrides,
    });

    it('should allow posts with target hashtag', () => {
      const post = createMockPost({
        caption: 'Check out our latest update! #MEO #restaurant'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(true);
      expect(result.matchedHashtags).toContain('#MEO');
    });

    it('should filter out posts without target hashtag', () => {
      const post = createMockPost({
        caption: 'Just a regular post #food #restaurant'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('Target hashtag');
    });

    it('should be case insensitive for hashtag matching', () => {
      const post = createMockPost({
        caption: 'Testing with #meo hashtag'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(true);
    });

    it('should filter out unsupported media types', () => {
      const post = createMockPost({
        caption: 'Video post with #MEO',
        media_type: 'VIDEO'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('Media type');
    });

    it('should filter out posts that are too old', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 2); // 2 days ago

      const post = createMockPost({
        caption: 'Old post with #MEO',
        timestamp: oldDate.toISOString()
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('too old');
    });

    it('should filter out posts without captions', () => {
      const post = createMockPost({
        caption: undefined
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('no caption');
    });

    it('should filter out posts with very short captions', () => {
      const post = createMockPost({
        caption: '#MEO'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('too short');
    });

    it('should filter out posts with too many hashtags', () => {
      const manyHashtags = Array.from({ length: 25 }, (_, i) => `#tag${i}`).join(' ');
      const post = createMockPost({
        caption: `Post with many hashtags #MEO ${manyHashtags}`
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(false);
      expect(result.reason).toContain('Too many hashtags');
    });

    it('should allow CAROUSEL_ALBUM media type', () => {
      const post = createMockPost({
        caption: 'Carousel post with #MEO hashtag',
        media_type: 'CAROUSEL_ALBUM'
      });

      const result = filter.filterPost(post);

      expect(result.shouldSync).toBe(true);
    });
  });

  describe('filterPosts', () => {
    it('should correctly separate posts to sync and filtered posts', () => {
      const posts: InstagramPost[] = [
        {
          id: 'post-1',
          caption: 'Good post #MEO',
          media_type: 'IMAGE',
          permalink: 'https://instagram.com/p/1',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'post-2',
          caption: 'Bad post #other',
          media_type: 'IMAGE',
          permalink: 'https://instagram.com/p/2',
          timestamp: new Date().toISOString(),
        },
        {
          id: 'post-3',
          caption: 'Another good post with lots of content #MEO',
          media_type: 'IMAGE',
          permalink: 'https://instagram.com/p/3',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = filter.filterPosts(posts);

      expect(result.toSync).toHaveLength(2);
      expect(result.filtered).toHaveLength(1);
      expect(result.toSync[0].id).toBe('post-1');
      expect(result.toSync[1].id).toBe('post-3');
      expect(result.filtered[0].post.id).toBe('post-2');
    });
  });

  describe('getFilterStats', () => {
    it('should return current filter configuration', () => {
      const stats = filter.getFilterStats();

      expect(stats).toEqual({
        targetHashtag: '#MEO',
        allowedMediaTypes: ['IMAGE', 'CAROUSEL_ALBUM'],
        maxPostAgeHours: 24,
        minCaptionLength: 10,
        maxHashtagCount: 20,
      });
    });
  });

  describe('updateTargetHashtag', () => {
    it('should update target hashtag', () => {
      filter.updateTargetHashtag('#NEWMEO');
      
      const post: InstagramPost = {
        id: 'test',
        caption: 'Test with #NEWMEO hashtag',
        media_type: 'IMAGE',
        permalink: 'https://instagram.com/p/test',
        timestamp: new Date().toISOString(),
      };

      const result = filter.filterPost(post);
      expect(result.shouldSync).toBe(true);
    });

    it('should throw error if hashtag does not start with #', () => {
      expect(() => {
        filter.updateTargetHashtag('INVALID');
      }).toThrow('Hashtag must start with #');
    });
  });
});