// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes';
import { AUTH_CONFIG } from './config/auth';

const app = express();

// Trust Render's reverse proxy for TLS termination, cookies, and rate limiting
app.set('trust proxy', 1);

// Security Headers (configured to allow cross-origin API requests from Vercel)
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Cookie parsing for HTTP-only session tokens
app.use(cookieParser());

// Body parser
app.use(express.json());

const ALLOWED_ORIGINS_SET = new Set([
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'https://monthly-finance-manager-ten.vercel.app',
]);

/**
 * Checks if a given request origin is allowed with fast O(1) set lookup.
 */
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests with no origin (curl, server-to-server, health checks)

  const clean = origin.trim().replace(/\/+$/, '');

  if (ALLOWED_ORIGINS_SET.has(clean)) {
    return true;
  }

  const configuredFrontend = AUTH_CONFIG.FRONTEND_URL;
  if (configuredFrontend && clean === configuredFrontend) {
    return true;
  }

  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  return false;
}

// 1. Explicit Preflight OPTIONS handler ensuring preflight requests never fail or pass to auth
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Cookie, X-Requested-With, Accept'
    );
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// 2. General CORS middleware for standard requests
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        // Return null, false to reject origin without throwing unhandled 500 error in Express
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Set-Cookie'],
  })
);

// API routes
app.use('/api', routes);

export default app;
