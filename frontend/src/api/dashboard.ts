// src/api/dashboard.ts
import { apiClient } from './client';
import type { DashboardResponse } from '../types/api';

export async function getDashboard(month: number, year: number): Promise<DashboardResponse> {
  const response = await apiClient.get<DashboardResponse>('/dashboard', {
    params: { month, year },
  });
  return response.data;
}
