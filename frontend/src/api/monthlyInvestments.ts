// src/api/monthlyInvestments.ts
import { apiClient } from './client';
import type { DashboardResponse } from '../types/api';

export async function getMonthlyInvestments(month: number, year: number): Promise<DashboardResponse> {
  const response = await apiClient.get<DashboardResponse>('/monthly-investments', {
    params: { month, year },
  });
  return response.data;
}

export async function updateMonthlyInvestment(
  planInvestmentId: string,
  payload: { year: number; month: number; actualAmount: number }
): Promise<{ success: boolean; breakdown: DashboardResponse }> {
  const response = await apiClient.put(`/monthly-investments/${planInvestmentId}`, payload);
  return response.data;
}

export async function batchUpdateMonthlyInvestments(payload: {
  year: number;
  month: number;
  investments: Array<{ planInvestmentId: string; actualAmount: number }>;
}): Promise<{ success: boolean; breakdown: DashboardResponse }> {
  const response = await apiClient.put('/monthly-investments', payload);
  return response.data;
}
