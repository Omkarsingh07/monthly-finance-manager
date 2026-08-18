// src/config/auth.ts
import 'dotenv/config';
import type { CookieOptions } from 'express';

/**
 * Sanitizes an environment variable by trimming whitespace and removing surrounding quotes.
 */
function cleanEnv(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

let cachedEmail: string | null = null;
let cachedPassword: string | null = null;
let cachedSessionSecret: string | null = null;
let cachedFrontendUrl: string | null = null;

export const AUTH_CONFIG = {
  get EMAIL(): string {
    if (cachedEmail === null) {
      cachedEmail = cleanEnv(process.env.AUTH_EMAIL).toLowerCase();
    }
    return cachedEmail;
  },
  get PASSWORD(): string {
    if (cachedPassword === null) {
      cachedPassword = cleanEnv(process.env.AUTH_PASSWORD);
    }
    return cachedPassword;
  },
  get SESSION_SECRET(): string {
    if (cachedSessionSecret === null) {
      cachedSessionSecret = cleanEnv(process.env.SESSION_SECRET) || 'fallback_dev_session_secret_local_only';
    }
    return cachedSessionSecret;
  },
  get FRONTEND_URL(): string {
    if (cachedFrontendUrl === null) {
      const raw = cleanEnv(process.env.FRONTEND_URL);
      cachedFrontendUrl = raw ? raw.replace(/\/+$/, '') : '';
    }
    return cachedFrontendUrl;
  },
  COOKIE_NAME: 'fm_session',
  COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * Validates authentication and environment configuration at startup.
 * Logs safe diagnostic status without revealing secrets.
 */
export function validateAuthConfig(): void {
  const isProduction = process.env.NODE_ENV === 'production';

  const hasEmail = Boolean(AUTH_CONFIG.EMAIL);
  const hasPassword = Boolean(AUTH_CONFIG.PASSWORD);
  const hasSecret = Boolean(cleanEnv(process.env.SESSION_SECRET));
  const hasFrontendUrl = Boolean(AUTH_CONFIG.FRONTEND_URL);

  console.log('[auth] --- Authentication & CORS Diagnostic ---');
  console.log(`[auth] NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[auth] AUTH_EMAIL configured: ${hasEmail}`);
  console.log(`[auth] AUTH_PASSWORD configured: ${hasPassword}`);
  console.log(`[auth] SESSION_SECRET configured: ${hasSecret}`);
  console.log(`[cors] FRONTEND_URL configured: ${hasFrontendUrl}`);
  if (hasFrontendUrl) {
    console.log(`[cors] Configured FRONTEND_URL: ${AUTH_CONFIG.FRONTEND_URL}`);
  }

  if (isProduction) {
    if (!hasEmail) {
      console.error('❌ Missing required authentication environment variable: AUTH_EMAIL');
    }
    if (!hasPassword) {
      console.error('❌ Missing required authentication environment variable: AUTH_PASSWORD');
    }
    if (!hasSecret) {
      console.error('❌ Missing required authentication environment variable: SESSION_SECRET');
    }
    if (!hasFrontendUrl) {
      console.warn('⚠️ FRONTEND_URL is not set in production. CORS might restrict frontend requests.');
    }
  }
}

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
