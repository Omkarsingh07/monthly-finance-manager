// src/utils/money.ts
import Decimal from 'decimal.js';

/**
 * Rounds a number to exactly 2 decimal places using Decimal.js Banker's/Standard rounding.
 */
export function roundMoney(amount: number | string | Decimal): number {
  return new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Sums an array of monetary values safely.
 */
export function sumMoney(amounts: Array<number | string | Decimal>): number {
  const sum = amounts.reduce<Decimal>((acc, val) => acc.plus(new Decimal(val || 0)), new Decimal(0));
  return roundMoney(sum);
}

/**
 * Calculates planned amounts for items ensuring the sum matches currentMonthTarget exactly.
 */
export function calculatePlannedAllocations(
  targetAmount: number,
  items: Array<{ id: string; weightage: number }>
): Map<string, number> {
  const target = new Decimal(targetAmount);
  const allocations = new Map<string, number>();

  let runningSum = new Decimal(0);

  items.forEach((item, index) => {
    if (index === items.length - 1) {
      // Last item gets remainder to prevent rounding discrepancies
      const remaining = target.minus(runningSum);
      allocations.set(item.id, roundMoney(remaining));
    } else {
      const planned = target.times(item.weightage).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      allocations.set(item.id, planned.toNumber());
      runningSum = runningSum.plus(planned);
    }
  });

  return allocations;
}
