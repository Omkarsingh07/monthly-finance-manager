// src/api/auth.ts
import { apiClient } from './client';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthStatusResponse {
  success: boolean;
  authenticated: boolean;
}

export interface GenericAuthResponse {
  success: boolean;
  message?: string;
  error?: string;
}

let checkAuthPromise: Promise<AuthStatusResponse> | null = null;

export const authApi = {
  login: async (payload: LoginPayload): Promise<GenericAuthResponse> => {
    checkAuthPromise = null; // Reset cached check promise on login
    const { data } = await apiClient.post<GenericAuthResponse>('/auth/login', payload);
    return data;
  },

  logout: async (): Promise<GenericAuthResponse> => {
    checkAuthPromise = null;
    const { data } = await apiClient.post<GenericAuthResponse>('/auth/logout');
    return data;
  },

  checkAuth: async (): Promise<AuthStatusResponse> => {
    if (!checkAuthPromise) {
      checkAuthPromise = apiClient
        .get<AuthStatusResponse>('/auth/me')
        .then((res) => res.data)
        .finally(() => {
          // Clear in-flight promise after small window so future explicit checks get fresh data
          setTimeout(() => {
            checkAuthPromise = null;
          }, 500);
        });
    }
    return checkAuthPromise;
  },
};
