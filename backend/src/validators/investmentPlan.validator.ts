// src/validators/investmentPlan.validator.ts
import { z } from 'zod';

export const CategoryEnum = z.enum(['STOCK', 'ETF', 'MUTUAL_FUND', 'OTHER']);

export const PlanInvestmentItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Investment name is required').trim(),
  category: CategoryEnum,
  weightage: z
    .number()
    .gt(0, 'Weightage must be greater than 0%')
    .lte(100, 'Weightage cannot exceed 100%'),
});

export const SaveInvestmentPlanSchema = z
  .object({
    monthlyAmount: z.number().gt(0, 'Monthly amount must be greater than 0'),
    effectiveFromMonth: z.number().int().min(1).max(12, 'Month must be between 1 and 12'),
    effectiveFromYear: z.number().int().min(2000).max(2100, 'Year must be a valid year'),
    investments: z
      .array(PlanInvestmentItemSchema)
      .min(1, 'At least one investment item is required'),
  })
  .refine(
    (data) => {
      const totalWeightage = data.investments.reduce((sum, item) => sum + item.weightage, 0);
      // Floating-point precision safe comparison (e.g. 99.99999 to 100.00001)
      return Math.abs(totalWeightage - 100) < 0.001;
    },
    {
      message: 'Total allocation weightage must equal exactly 100%',
      path: ['investments'],
    }
  );

export type SaveInvestmentPlanInput = z.infer<typeof SaveInvestmentPlanSchema>;
export type PlanInvestmentItemInput = z.infer<typeof PlanInvestmentItemSchema>;
