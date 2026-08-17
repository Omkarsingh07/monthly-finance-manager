// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { authService, SessionPayload } from '../services/auth.service';
import { AUTH_CONFIG } from '../config/auth';

export interface AuthenticatedRequest extends Request {
  user?: SessionPayload;
}

/**
 * Middleware that guards all finance API endpoints.
 * Extracts token from HTTP-only cookie or Authorization header.
 * Rejects unauthenticated requests with HTTP 401.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // 1. Check HTTP-only cookie first
  let token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];

  // 2. Check Authorization Bearer header as secondary fallback (for API tools/scripts)
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Authentication required',
    });
    return;
  }

  const session = authService.verifySessionToken(token);
  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid or expired session',
    });
    return;
  }

  req.user = session;
  next();
}
