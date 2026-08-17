// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, type LoginPayload } from '../api/auth';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (payload: LoginPayload) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    try {
      const res = await authApi.checkAuth();
      if (res.authenticated) {
        setIsAuthenticated(true);
        return true;
      } else {
        setIsAuthenticated(false);
        return false;
      }
    } catch {
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (payload: LoginPayload): Promise<{ success: boolean; message?: string }> => {
    try {
      const res = await authApi.login(payload);
      if (res.success) {
        setIsAuthenticated(true);
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err: unknown) {
      let message = 'Invalid email or password';
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const resp = (err as { response?: { data?: { message?: string; error?: string } } }).response;
        message = resp?.data?.message || resp?.data?.error || message;
      }
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } catch (err) {
      console.error('[auth] Logout error:', err);
    } finally {
      setIsAuthenticated(false);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
