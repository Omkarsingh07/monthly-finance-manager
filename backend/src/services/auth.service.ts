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
    if (!AUTH_CONFIG.EMAIL || !AUTH_CONFIG.PASSWORD) {
      console.warn('[auth] AUTH_EMAIL or AUTH_PASSWORD is not set in environment variables!');
      return false;
    }

    const normalizedInputEmail = (email || '').trim().toLowerCase();
    const isEmailValid = normalizedInputEmail === AUTH_CONFIG.EMAIL;
    const isPasswordValid = password === AUTH_CONFIG.PASSWORD;

    return isEmailValid && isPasswordValid;
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

    return jwt.sign(payload, AUTH_CONFIG.SESSION_SECRET, {
      expiresIn: '7d',
    });
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
