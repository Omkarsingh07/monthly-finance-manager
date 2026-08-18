// src/controllers/investmentPlan.controller.ts
import { Request, Response } from 'express';
import { investmentPlanService } from '../services/investmentPlan.service';
import { SaveInvestmentPlanSchema } from '../validators/investmentPlan.validator';
import { z } from 'zod';

export async function getInvestmentPlan(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const month = req.query.month ? parseInt(req.query.month as string, 10) : undefined;
    const year = req.query.year ? parseInt(req.query.year as string, 10) : undefined;

    const plan = await investmentPlanService.getActivePlan(month, year);

    console.log(`[PERF] investment-plan: ${Date.now() - startTime}ms`);
    if (!plan) {
      res.status(200).json({
        noPlan: true,
        message: 'No investment plan configured.',
      });
      return;
    }

    res.status(200).json({
      noPlan: false,
      planVersion: plan.planVersion,
      monthlyAmount: plan.monthlyAmount,
      effectiveFromMonth: plan.effectiveFromMonth,
      effectiveFromYear: plan.effectiveFromYear,
      investments: plan.investments,
    });
  } catch (error: any) {
    console.log(`[PERF] investment-plan: ${Date.now() - startTime}ms (error)`);
    console.error('[investmentPlan] Error in getInvestmentPlan:', error);
    res.status(500).json({
      error: 'Failed to retrieve investment plan',
      details: error?.message || String(error),
    });
  }
}

export async function saveInvestmentPlan(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const parseResult = SaveInvestmentPlanSchema.safeParse(req.body);

    if (!parseResult.success) {
      console.log(`[PERF] investment-plan/save: ${Date.now() - startTime}ms (validation error)`);
      res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const savedPlan = await investmentPlanService.savePlan(parseResult.data);

    console.log(`[PERF] investment-plan/save: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
      message: 'Investment plan saved successfully',
      plan: savedPlan,
    });
  } catch (error: any) {
    console.log(`[PERF] investment-plan/save: ${Date.now() - startTime}ms (error)`);
    console.error('[investmentPlan] Error in saveInvestmentPlan:', error);
    res.status(500).json({
      error: 'Failed to save investment plan',
      details: error?.message || String(error),
    });
  }
}

export async function deletePlanItem(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  try {
    const idParam = req.params.id;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    if (!id) {
      res.status(400).json({ error: 'Item ID is required' });
      return;
    }

    const deleted = await investmentPlanService.deletePlanItem(id);
    if (!deleted) {
      res.status(404).json({ error: 'Investment item not found' });
      return;
    }

    console.log(`[PERF] investment-plan/delete: ${Date.now() - startTime}ms`);
    res.status(200).json({
      success: true,
      deletedId: id,
    });
  } catch (error: any) {
    console.log(`[PERF] investment-plan/delete: ${Date.now() - startTime}ms (error)`);
    console.error('[investmentPlan] Error in deletePlanItem:', error);
    res.status(500).json({
      error: 'Failed to delete plan item',
      details: error?.message || String(error),
    });
  }
}
