import { body, query, param, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation error handler middleware
export function handleValidationErrors(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
}

// Login validation
export const validateLogin = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  handleValidationErrors
];

// Logs query validation
export const validateLogsQuery = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 10000 }).withMessage('Page must be between 1 and 10000')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  handleValidationErrors
];

// Webhook validation
export const validateWebhook = [
  body('object')
    .notEmpty().withMessage('Object field is required')
    .isString().withMessage('Object must be a string'),
  body('entry')
    .notEmpty().withMessage('Entry field is required')
    .isArray().withMessage('Entry must be an array'),
  handleValidationErrors
];

// Instagram webhook signature validation
export const validateWebhookSignature = (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }
  
  // Signature format validation
  if (!signature.startsWith('sha256=') || signature.length !== 71) { // sha256= (7) + 64 hex chars
    return res.status(401).json({
      success: false,
      message: 'Invalid signature format'
    });
  }
  
  next();
};

// Poll command validation
export const validatePollOptions = [
  body('dryRun')
    .optional()
    .isBoolean().withMessage('dryRun must be a boolean'),
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  handleValidationErrors
];

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  // Basic HTML entity encoding
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\//g, '&#x2F;');
}

// Sanitize file paths to prevent path traversal
export function sanitizePath(path: string): string {
  // Remove any path traversal attempts
  return path
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*]/g, '') // Remove invalid filename characters
    .replace(/\/+/g, '/'); // Normalize multiple slashes
}

// Validate and sanitize Instagram post ID
export const validateInstagramPostId = [
  param('postId')
    .notEmpty().withMessage('Post ID is required')
    .matches(/^[0-9A-Za-z_-]+$/).withMessage('Invalid post ID format')
    .isLength({ max: 100 }).withMessage('Post ID too long'),
  handleValidationErrors
];

// Validate environment configuration
export function validateEnvironmentConfig(): string[] {
  const errors: string[] = [];
  
  // Check for secure values in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be set and at least 32 characters long in production');
    }
    
    if (process.env.ADMIN_PASSWORD === 'changeme') {
      errors.push('Default admin password cannot be used in production');
    }
    
    if (!process.env.ALLOWED_ORIGINS) {
      errors.push('ALLOWED_ORIGINS should be set in production');
    }
  }
  
  // Check for required API configurations
  const requiredEnvVars = [
    'INSTAGRAM_APP_ID',
    'INSTAGRAM_APP_SECRET',
    'INSTAGRAM_ACCESS_TOKEN',
    'INSTAGRAM_BUSINESS_ACCOUNT_ID',
    'GBP_CLIENT_ID',
    'GBP_CLIENT_SECRET',
    'GBP_REFRESH_TOKEN',
    'GBP_ACCOUNT_ID',
    'GBP_LOCATION_ID'
  ];
  
  // In production, all must be set
  if (process.env.NODE_ENV === 'production') {
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        errors.push(`${envVar} is required in production`);
      }
    }
  }
  
  return errors;
}

// Custom validation for numeric ranges
export function createRangeValidator(field: string, min: number, max: number) {
  return query(field)
    .optional()
    .custom((value) => {
      const num = parseInt(value, 10);
      if (isNaN(num)) return false;
      return num >= min && num <= max;
    })
    .withMessage(`${field} must be between ${min} and ${max}`)
    .toInt();
}