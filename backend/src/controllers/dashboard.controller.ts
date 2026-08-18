// src/controllers/dashboard.controller.ts
import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { MonthlyQuerySchema } from '../validators/monthlyInvestment.validator';
import { z } from 'zod';

export async function getDashboard(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();

    const month = req.query.month ? parseInt(req.query.month as string, 10) : defaultMonth;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : defaultYear;

    const validation = MonthlyQuerySchema.safeParse({ month, year });
    if (!validation.success) {
      console.log(`[PERF] dashboard: ${Date.now() - startTime}ms (validation error)`);
      res.status(400).json({
        error: 'Invalid month or year query parameter',
        details: validation.error.issues.map((i: z.ZodIssue) => i.message),
      });
      return;
    }

    const dashboard = await dashboardService.getDashboard(month, year);
    console.log(`[PERF] dashboard: ${Date.now() - startTime}ms (month: ${month}, year: ${year})`);
    res.status(200).json(dashboard);
  } catch (error: any) {
    console.log(`[PERF] dashboard: ${Date.now() - startTime}ms (error)`);
    console.error('[dashboard] Error in getDashboard:', error);
    res.status(500).json({
      error: 'Failed to retrieve dashboard data',
      details: error?.message || String(error),
    });
  }
}
