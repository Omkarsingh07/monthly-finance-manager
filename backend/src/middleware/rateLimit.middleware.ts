// src/middleware/rateLimit.middleware.ts
import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for login endpoint to prevent brute-force attacks.
 * 15-minute window, max 10 attempts per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again after 15 minutes.',
  },
});
