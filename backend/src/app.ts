// src/app.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import routes from './routes';

const app = express();

// Security Headers
app.use(helmet());

// Cookie parsing for HTTP-only session tokens
app.use(cookieParser());

// Body parser
app.use(express.json());

// Strict CORS with credentials support for Vercel frontend & local dev
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/+$/, '') : '',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, server-to-server, health checks)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// API routes
app.use('/api', routes);

export default app;
