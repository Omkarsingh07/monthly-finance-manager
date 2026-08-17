// src/api/client.ts
import axios from 'axios';

/**
 * Resolves the API base URL cleanly:
 * - In local dev (when VITE_API_URL is empty): returns '/api' so Vite proxy forwards to localhost:3001.
 * - In production: ensures the target URL always points to the '/api' prefix on Render backend.
 */
function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl || envUrl.trim() === '') {
    return '/api';
  }

  const trimmed = envUrl.trim().replace(/\/+$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.endsWith('/api')) {
      return trimmed;
    }
    return `${trimmed}/api`;
  }

  return trimmed || '/api';
}

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
});
