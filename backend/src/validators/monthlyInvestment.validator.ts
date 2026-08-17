// src/validators/monthlyInvestment.validator.ts
import { z } from 'zod';

export const MonthlyQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export const UpdateMonthlyInvestmentSchema = z.object({
  year: z.number().int().min(2000).max(2100, 'Year must be a valid year'),
  month: z.number().int().min(1).max(12, 'Month must be between 1 and 12'),
  actualAmount: z.number().min(0, 'Actual investment amount must be greater than or equal to 0'),
});

export const BatchUpdateMonthlyInvestmentsSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  investments: z.array(
    z.object({
      planInvestmentId: z.string().min(1, 'planInvestmentId is required'),
      actualAmount: z.number().min(0, 'Actual amount must be greater than or equal to 0'),
    })
  ),
});

export type UpdateMonthlyInvestmentInput = z.infer<typeof UpdateMonthlyInvestmentSchema>;
export type BatchUpdateMonthlyInvestmentsInput = z.infer<typeof BatchUpdateMonthlyInvestmentsSchema>;
