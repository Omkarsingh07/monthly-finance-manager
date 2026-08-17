// src/services/auth.service.ts
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AUTH_CONFIG } from '../config/auth';

export interface SessionPayload {
  email: string;
  role: string;
  jti: string;
}

export class AuthService {
  /**
   * Verifies login credentials against environment variables.
   */
  verifyCredentials(email: string, password: string): boolean {
    const configuredEmail = AUTH_CONFIG.EMAIL;
    const configuredPassword = AUTH_CONFIG.PASSWORD;

    if (!configuredEmail || !configuredPassword) {
      console.warn('[auth] AUTH_EMAIL or AUTH_PASSWORD is not set in environment variables!');
      return false;
    }

    const inputEmail = (email || '').trim().toLowerCase();
    const inputPassword = (password || '').trim();

    const isEmailValid = inputEmail === configuredEmail;
    const isPasswordValid = inputPassword === configuredPassword;

    if (isEmailValid && isPasswordValid) {
      console.log(`[auth] Credentials accepted for: ${inputEmail}`);
      return true;
    } else {
      console.log(`[auth] Credentials rejected for: ${inputEmail} (Email match: ${isEmailValid}, Password match: ${isPasswordValid})`);
      return false;
    }
  }

  /**
   * Generates a signed stateless JWT session token.
   */
  generateSessionToken(email: string): string {
    const payload: SessionPayload = {
      email: email.trim().toLowerCase(),
      role: 'owner',
      jti: uuidv4(),
    };

    const token = jwt.sign(payload, AUTH_CONFIG.SESSION_SECRET, {
      expiresIn: '7d',
    });

    console.log(`[auth] Session created for: ${payload.email}`);
    return token;
  }

  /**
   * Verifies and decodes a session token.
   */
  verifySessionToken(token: string): SessionPayload | null {
    try {
      const decoded = jwt.verify(token, AUTH_CONFIG.SESSION_SECRET) as SessionPayload;
      return decoded;
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
