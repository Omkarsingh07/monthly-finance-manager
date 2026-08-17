// src/server.ts
import 'dotenv/config';
import app from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] Running on port ${PORT}`);
  console.log(`[server] NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
});

