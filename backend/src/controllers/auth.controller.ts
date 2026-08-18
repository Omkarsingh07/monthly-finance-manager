// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AUTH_CONFIG, getSessionCookieOptions } from '../config/auth';
import { LoginSchema } from '../validators/auth.validator';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    console.log('[auth] Login attempt received');
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log(`[PERF] auth/login: ${Date.now() - startTime}ms (validation error)`);
      res.status(400).json({
        success: false,
        error: parseResult.error.issues.map((i) => i.message).join(', '),
      });
      return;
    }

    const { email, password } = parseResult.data;
    const isValid = authService.verifyCredentials(email, password);

    if (!isValid) {
      console.log(`[PERF] auth/login: ${Date.now() - startTime}ms (invalid credentials)`);
      res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    // Generate secure session token and set HTTP-only cookie
    const token = authService.generateSessionToken(email);
    const cookieOptions = getSessionCookieOptions();

    res.cookie(AUTH_CONFIG.COOKIE_NAME, token, cookieOptions);

    console.log(`[PERF] auth/login: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
      authenticated: true,
    });
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    console.log('[auth] Logout requested');
    const cookieOptions = getSessionCookieOptions();
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME, cookieOptions);

    console.log(`[PERF] auth/logout: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
    });
  }

  /**
   * GET /api/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      console.log(`[PERF] auth/me: ${Date.now() - startTime}ms (unauthenticated)`);
      res.status(401).json({
        success: false,
        authenticated: false,
      });
      return;
    }

    const session = authService.verifySessionToken(token);
    if (!session) {
      console.log('[auth] /api/auth/me: Invalid or expired session');
      console.log(`[PERF] auth/me: ${Date.now() - startTime}ms (invalid session)`);
      res.status(401).json({
        success: false,
        authenticated: false,
      });
      return;
    }

    console.log(`[PERF] auth/me: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
      authenticated: true,
    });
  }
}

export const authController = new AuthController();
