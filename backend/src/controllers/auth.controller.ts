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
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: parseResult.error.issues.map((i) => i.message).join(', '),
      });
      return;
    }

    const { email, password } = parseResult.data;
    const isValid = authService.verifyCredentials(email, password);

    if (!isValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate secure session token and set HTTP-only cookie
    const token = authService.generateSessionToken(email);
    const cookieOptions = getSessionCookieOptions();

    res.cookie(AUTH_CONFIG.COOKIE_NAME, token, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
    });
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    const cookieOptions = getSessionCookieOptions();
    res.clearCookie(AUTH_CONFIG.COOKIE_NAME, cookieOptions);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  }

  /**
   * GET /api/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    let token = req.cookies?.[AUTH_CONFIG.COOKIE_NAME];
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7);
    }

    if (!token) {
      res.status(401).json({
        success: false,
        authenticated: false,
      });
      return;
    }

    const session = authService.verifySessionToken(token);
    if (!session) {
      res.status(401).json({
        success: false,
        authenticated: false,
      });
      return;
    }

    res.status(200).json({
      success: true,
      authenticated: true,
    });
  }
}

export const authController = new AuthController();
