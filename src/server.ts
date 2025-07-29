import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { appConfig, validateConfig } from './config';
import { log, syncLogger } from './logger';
import { instagramAPI } from './instagram';
import { gbpAPI } from './gbp';
import { postFilter } from './filters';
import {
  InstagramWebhookPayload,
  SyncLog,
  ApiResponse,
  LogsApiResponse,
} from './types';

// Initialize Express app
const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    log.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  });
  
  next();
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  log.error('Unhandled error in request', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: appConfig.env === 'development' ? error.message : 'Something went wrong',
  } as ApiResponse);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: appConfig.env,
    },
  } as ApiResponse);
});

// Instagram webhook verification (GET)
app.get(appConfig.server.webhookPath, (req: Request, res: Response) => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  log.info('Instagram webhook verification request', { mode, token });

  const verifiedChallenge = instagramAPI.verifyWebhookChallenge(mode, token, challenge);
  
  if (verifiedChallenge) {
    log.info('Instagram webhook verification successful');
    res.status(200).send(verifiedChallenge);
  } else {
    log.warn('Instagram webhook verification failed');
    res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Webhook verification failed',
    } as ApiResponse);
  }
});

// Instagram webhook handler (POST)
app.post(appConfig.server.webhookPath, async (req: Request, res: Response) => {
  try {
    const signature = req.get('X-Hub-Signature-256');
    const payload = JSON.stringify(req.body);

    if (!signature) {
      log.warn('Instagram webhook missing signature');
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Missing signature',
      } as ApiResponse);
    }

    // Verify webhook signature
    if (!instagramAPI.verifyWebhookSignature(payload, signature)) {
      log.warn('Instagram webhook signature verification failed');
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Invalid signature',
      } as ApiResponse);
    }

    const webhookPayload = req.body as InstagramWebhookPayload;
    log.info('Instagram webhook received', {
      object: webhookPayload.object,
      entriesCount: webhookPayload.entry?.length || 0,
    });

    // Process webhook asynchronously
    processWebhookAsync(webhookPayload).catch(error => {
      log.error('Webhook processing failed', { error });
    });

    // Respond immediately to Instagram
    res.status(200).json({
      success: true,
      message: 'Webhook received',
    } as ApiResponse);

  } catch (error) {
    log.error('Instagram webhook handler error', { error });
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process webhook',
    } as ApiResponse);
  }
});

// API: Get sync logs
app.get(`${appConfig.server.apiBasePath}/logs`, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;

    const logs = await syncLogger.getSyncLogs(limit, offset);
    const stats = await syncLogger.getSyncLogStats();

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: stats.total,
          page,
          limit,
          totalPages: Math.ceil(stats.total / limit),
        },
      },
    } as LogsApiResponse);

  } catch (error) {
    log.error('Failed to fetch logs', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch logs',
      message: (error as Error).message,
    } as ApiResponse);
  }
});

// API: Get sync statistics
app.get(`${appConfig.server.apiBasePath}/stats`, async (req: Request, res: Response) => {
  try {
    const stats = await syncLogger.getSyncLogStats();
    const filterStats = postFilter.getFilterStats();
    const gbpTokenStatus = gbpAPI.getTokenStatus();

    res.json({
      success: true,
      data: {
        sync: stats,
        filter: filterStats,
        gbp: gbpTokenStatus,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '1.0.0',
        },
      },
    } as ApiResponse);

  } catch (error) {
    log.error('Failed to fetch stats', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
      message: (error as Error).message,
    } as ApiResponse);
  }
});

// API: Test Instagram connection
app.post(`${appConfig.server.apiBasePath}/test/instagram`, async (req: Request, res: Response) => {
  try {
    const result = await instagramAPI.testConnection();
    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
    } as ApiResponse);

  } catch (error) {
    log.error('Instagram connection test failed', { error });
    res.status(500).json({
      success: false,
      error: 'Instagram test failed',
      message: (error as Error).message,
    } as ApiResponse);
  }
});

// API: Test GBP connection
app.post(`${appConfig.server.apiBasePath}/test/gbp`, async (req: Request, res: Response) => {
  try {
    const result = await gbpAPI.testConnection();
    res.json({
      success: result.success,
      data: result.data,
      message: result.message,
    } as ApiResponse);

  } catch (error) {
    log.error('GBP connection test failed', { error });
    res.status(500).json({
      success: false,
      error: 'GBP test failed',
      message: (error as Error).message,
    } as ApiResponse);
  }
});

// Dashboard route
app.get('/', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Setup guide route
app.get('/setup', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'setup-guide.html'));
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found',
  } as ApiResponse);
});

// Async webhook processing
async function processWebhookAsync(payload: InstagramWebhookPayload): Promise<void> {
  try {
    log.info('Processing webhook payload asynchronously');

    const newPosts = await instagramAPI.processWebhookPayload(payload);
    
    if (newPosts.length === 0) {
      log.info('No new posts to process from webhook');
      return;
    }

    log.info('Processing new posts from webhook', { count: newPosts.length });

    for (const post of newPosts) {
      await processSinglePost(post);
    }

  } catch (error) {
    log.error('Async webhook processing failed', { error });
  }
}

// Process a single Instagram post
async function processSinglePost(post: any): Promise<void> {
  const startTime = Date.now();
  const syncId = `${post.id}-${Date.now()}`;

  try {
    log.info('Processing Instagram post', {
      syncId,
      postId: post.id,
      timestamp: post.timestamp,
    });

    // Filter the post
    const filterResult = postFilter.filterPost(post);
    
    if (!filterResult.shouldSync) {
      await syncLogger.logSync({
        id: syncId,
        timestamp: new Date().toISOString(),
        instagramPostId: post.id,
        instagramCaption: post.caption,
        instagramMediaUrl: post.media_url,
        status: 'skipped',
        hashtags: filterResult.matchedHashtags,
        syncDuration: Date.now() - startTime,
      });

      log.info('Post skipped due to filter', {
        syncId,
        postId: post.id,
        reason: filterResult.reason,
      });
      return;
    }

    // Create GBP post
    const gbpPostId = await gbpAPI.createLocalPost(post);

    await syncLogger.logSync({
      id: syncId,
      timestamp: new Date().toISOString(),
      instagramPostId: post.id,
      instagramCaption: post.caption,
      instagramMediaUrl: post.media_url,
      gbpPostId,
      status: 'success',
      hashtags: filterResult.matchedHashtags,
      syncDuration: Date.now() - startTime,
    });

    log.info('Post synchronized successfully', {
      syncId,
      postId: post.id,
      gbpPostId,
      duration: Date.now() - startTime,
    });

  } catch (error) {
    await syncLogger.logSync({
      id: syncId,
      timestamp: new Date().toISOString(),
      instagramPostId: post.id,
      instagramCaption: post.caption,
      instagramMediaUrl: post.media_url,
      status: 'failed',
      error: (error as Error).message,
      hashtags: [],
      syncDuration: Date.now() - startTime,
    });

    log.error('Post synchronization failed', {
      syncId,
      postId: post.id,
      error,
      duration: Date.now() - startTime,
    });
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    // Validate configuration
    validateConfig();
    
    // Initialize logger
    await syncLogger.init();

    // Start server
    const server = app.listen(appConfig.server.port, () => {
      log.info('MEO Sync server started', {
        port: appConfig.server.port,
        environment: appConfig.env,
        webhookPath: appConfig.server.webhookPath,
        apiBasePath: appConfig.server.apiBasePath,
      });
    });

    // Handle port errors
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log.error(`Port ${appConfig.server.port} is already in use`);
        process.exit(1);
      }
      throw err;
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      log.info('Received SIGINT, shutting down gracefully');
      server.close(() => {
        log.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      log.info('Received SIGTERM, shutting down gracefully');
      server.close(() => {
        log.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    log.error('Failed to start server', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

// Export for CLI usage
export { app, startServer, processSinglePost };

// Export default for Vercel
export default app;

// Start server if called directly
if (require.main === module) {
  startServer();
}