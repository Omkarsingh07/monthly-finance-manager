// src/server.ts
import 'dotenv/config';
import app from './app';
import { validateAuthConfig } from './config/auth';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Validate authentication and CORS configuration on startup
validateAuthConfig();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Running on port ${PORT}`);
  console.log(`[server] NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
});
