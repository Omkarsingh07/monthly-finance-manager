// src/controllers/monthlyInvestment.controller.ts
import { Request, Response } from 'express';
import { monthlyInvestmentService } from '../services/monthlyInvestment.service';
import {
  UpdateMonthlyInvestmentSchema,
  BatchUpdateMonthlyInvestmentsSchema,
  MonthlyQuerySchema,
} from '../validators/monthlyInvestment.validator';
import { z } from 'zod';

export async function getMonthlyInvestments(req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const defaultMonth = now.getMonth() + 1;
    const defaultYear = now.getFullYear();

    const month = req.query.month ? parseInt(req.query.month as string, 10) : defaultMonth;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : defaultYear;

    const queryValidation = MonthlyQuerySchema.safeParse({ month, year });
    if (!queryValidation.success) {
      res.status(400).json({
        error: 'Invalid query parameters',
        details: queryValidation.error.issues.map((i: z.ZodIssue) => i.message),
      });
      return;
    }

    const breakdown = await monthlyInvestmentService.getMonthlyBreakdown(month, year);
    res.status(200).json(breakdown);
  } catch (error: any) {
    console.error('[monthlyInvestment] Error in getMonthlyInvestments:', error);
    res.status(500).json({
      error: 'Failed to retrieve monthly investments',
      details: error?.message || String(error),
    });
  }
}

export async function updateMonthlyInvestment(req: Request, res: Response): Promise<void> {
  try {
    const planInvestmentIdParam = req.params.planInvestmentId;
    const planInvestmentId = Array.isArray(planInvestmentIdParam)
      ? planInvestmentIdParam[0]
      : planInvestmentIdParam;

    if (!planInvestmentId) {
      res.status(400).json({ error: 'planInvestmentId is required' });
      return;
    }

    const validation = UpdateMonthlyInvestmentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues.map((i: z.ZodIssue) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const { year, month, actualAmount } = validation.data;
    const record = await monthlyInvestmentService.upsertActualAmount(
      planInvestmentId,
      year,
      month,
      actualAmount
    );

    // Return the updated monthly breakdown
    const updatedBreakdown = await monthlyInvestmentService.getMonthlyBreakdown(month, year);

    res.status(200).json({
      success: true,
      message: 'Monthly investment updated successfully',
      record,
      breakdown: updatedBreakdown,
    });
  } catch (error: any) {
    console.error('[monthlyInvestment] Error in updateMonthlyInvestment:', error);
    res.status(500).json({
      error: 'Failed to update monthly investment',
      details: error?.message || String(error),
    });
  }
}

export async function batchUpdateMonthlyInvestments(req: Request, res: Response): Promise<void> {
  try {
    const validation = BatchUpdateMonthlyInvestmentsSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: validation.error.issues.map((i: z.ZodIssue) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }

    const { year, month, investments } = validation.data;
    const updatedBreakdown = await monthlyInvestmentService.batchUpsertActualAmounts(
      year,
      month,
      investments
    );

    res.status(200).json({
      success: true,
      message: 'Monthly investments updated successfully',
      breakdown: updatedBreakdown,
    });
  } catch (error: any) {
    console.error('[monthlyInvestment] Error in batchUpdateMonthlyInvestments:', error);
    res.status(500).json({
      error: 'Failed to update monthly investments',
      details: error?.message || String(error),
    });
  }
}
