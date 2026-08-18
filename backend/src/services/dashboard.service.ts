// src/services/dashboard.service.ts
import { monthlyInvestmentService, MonthlyBreakdownResponse } from './monthlyInvestment.service';

export interface DashboardResponse extends MonthlyBreakdownResponse {
  totalInvestment: number;
}

export class DashboardService {
  /**
   * Generates the complete dashboard payload for a given (month, year)
   * by combining the monthly breakdown and total historical actual investment
   * in a single batch read.
   */
  async getDashboard(month: number, year: number): Promise<DashboardResponse> {
    const { breakdown, totalInvestment } = await monthlyInvestmentService.getDashboardData(month, year);

    return {
      ...breakdown,
      totalInvestment,
    };
  }
}

export const dashboardService = new DashboardService();
