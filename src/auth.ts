import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';
import { log } from './logger';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
      };
    }
  }
}

// Get JWT secret from environment or use a secure default for development
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// In production, these should be stored in a database
const ADMIN_USERS = new Map<string, string>();

// Initialize admin user from environment variables
async function initializeAdminUser() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
  
  if (process.env.NODE_ENV === 'production' && adminPassword === 'changeme') {
    log.error('Using default admin password in production!');
    throw new Error('Default admin password cannot be used in production');
  }
  
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  ADMIN_USERS.set(adminUsername, hashedPassword);
  
  log.info('Admin user initialized', { username: adminUsername });
}

// Initialize on module load
initializeAdminUser().catch(error => {
  log.error('Failed to initialize admin user', { error });
});

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  message?: string;
}

// Login function
export async function login(username: string, password: string): Promise<AuthResponse> {
  try {
    const hashedPassword = ADMIN_USERS.get(username);
    
    if (!hashedPassword) {
      return { success: false, message: 'Invalid credentials' };
    }
    
    const isValid = await bcrypt.compare(password, hashedPassword);
    
    if (!isValid) {
      return { success: false, message: 'Invalid credentials' };
    }
    
    const token = jwt.sign(
      { id: username, username } as any,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );
    
    log.info('User logged in', { username });
    
    return { success: true, token };
  } catch (error) {
    log.error('Login error', { error });
    return { success: false, message: 'Authentication failed' };
  }
}

// Authentication middleware
export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authorization header' 
      });
    }
    
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    log.error('Auth middleware error', { error });
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
}

// Optional auth middleware (allows both authenticated and unauthenticated requests)
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next();
  }
  
  // If auth header is present, validate it
  authMiddleware(req, res, next);
}

// Generate a secure random secret for JWT
export function generateSecret(): string {
  return require('crypto').randomBytes(64).toString('hex');
}

// Refresh token function
export function refreshToken(oldToken: string): AuthResponse {
  try {
    const decoded = jwt.verify(oldToken, JWT_SECRET) as any;
    
    const newToken = jwt.sign(
      { id: decoded.id, username: decoded.username } as any,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN } as any
    );
    
    return { success: true, token: newToken };
  } catch (error) {
    return { success: false, message: 'Invalid token' };
  }
}