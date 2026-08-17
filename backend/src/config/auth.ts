// src/config/auth.ts
import 'dotenv/config';
import type { CookieOptions } from 'express';

export const AUTH_CONFIG = {
  EMAIL: (process.env.AUTH_EMAIL || '').trim().toLowerCase(),
  PASSWORD: process.env.AUTH_PASSWORD || '',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev_session_secret_for_local_testing_only',
  COOKIE_NAME: 'fm_session',
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * Generates cookie options appropriate for the runtime environment.
 * In production (Render <-> Vercel cross-domain): secure: true, sameSite: 'none'.
 * In local development (localhost): secure: false, sameSite: 'lax'.
 */
export function getSessionCookieOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: AUTH_CONFIG.COOKIE_MAX_AGE,
    path: '/',
  };
}
