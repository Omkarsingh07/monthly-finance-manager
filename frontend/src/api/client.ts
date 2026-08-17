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
  withCredentials: true, // Send HTTP-only session cookies with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle unauthorized (401) responses
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const isAuthEndpoint =
        error.config?.url?.includes('/auth/login') ||
        error.config?.url?.includes('/auth/me') ||
        error.config?.url?.includes('/auth/logout');

      // If unauthorized on protected route and not already on /login, redirect
      if (!isAuthEndpoint && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
