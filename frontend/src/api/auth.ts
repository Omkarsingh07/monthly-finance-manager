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

export const authApi = {
  login: async (payload: LoginPayload): Promise<GenericAuthResponse> => {
    const { data } = await apiClient.post<GenericAuthResponse>('/auth/login', payload);
    return data;
  },

  logout: async (): Promise<GenericAuthResponse> => {
    const { data } = await apiClient.post<GenericAuthResponse>('/auth/logout');
    return data;
  },

  checkAuth: async (): Promise<AuthStatusResponse> => {
    const { data } = await apiClient.get<AuthStatusResponse>('/auth/me');
    return data;
  },
};
