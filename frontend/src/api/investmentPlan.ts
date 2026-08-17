// src/api/investmentPlan.ts
import { apiClient } from './client';
import type { InvestmentCategory } from '../types/api';

export interface PlanInvestmentItemInput {
  id?: string;
  name: string;
  category: InvestmentCategory;
  weightage: number;
}

export interface SaveInvestmentPlanInput {
  monthlyAmount: number;
  effectiveFromMonth: number;
  effectiveFromYear: number;
  investments: PlanInvestmentItemInput[];
}

export interface InvestmentPlanResponse {
  noPlan: boolean;
  message?: string;
  planVersion?: number;
  monthlyAmount?: number;
  effectiveFromMonth?: number;
  effectiveFromYear?: number;
  investments?: Array<{
    id: string;
    name: string;
    category: InvestmentCategory;
    weightage: number;
    effectiveFromMonth: number;
    effectiveFromYear: number;
    planVersion: number;
  }>;
}

export async function getInvestmentPlan(month?: number, year?: number): Promise<InvestmentPlanResponse> {
  const response = await apiClient.get<InvestmentPlanResponse>('/investment-plan', {
    params: { month, year },
  });
  return response.data;
}

export async function saveInvestmentPlan(payload: SaveInvestmentPlanInput): Promise<{ success: boolean; plan: any }> {
  const response = await apiClient.post('/investment-plan', payload);
  return response.data;
}

export async function deleteInvestmentPlanItem(id: string): Promise<{ success: boolean; deletedId: string }> {
  const response = await apiClient.delete(`/investment-plan/item/${id}`);
  return response.data;
}
