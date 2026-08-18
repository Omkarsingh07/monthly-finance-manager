// src/utils/money.ts
import Decimal from 'decimal.js';

/**
 * Rounds a number to exactly 2 decimal places using Decimal.js Banker's/Standard rounding.
 */
export function roundMoney(amount: number | string | Decimal): number {
  return new Decimal(amount || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Sums an array of monetary values safely.
 */
export function sumMoney(amounts: Array<number | string | Decimal>): number {
  const sum = amounts.reduce<Decimal>((acc, val) => acc.plus(new Decimal(val || 0)), new Decimal(0));
  return roundMoney(sum);
}

/**
 * Calculates planned amounts for items ensuring the sum matches targetAmount exactly.
 */
export function calculatePlannedAllocations(
  targetAmount: number,
  items: Array<{ id: string; weightage: number }>
): Map<string, number> {
  const target = new Decimal(targetAmount || 0);
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

/**
 * Calculates whole shares to purchase and remaining amount.
 * Fractional shares/units are strictly disallowed: shares = floor(availableAmount / unitPrice).
 */
export function calculateWholeShares(
  availableAmount: number | string | Decimal,
  unitPrice?: number | string | Decimal
): { shares: number; totalCost: number; remaining: number } {
  const available = new Decimal(availableAmount || 0);
  const price = new Decimal(unitPrice || 0);

  if (price.lessThanOrEqualTo(0)) {
    return {
      shares: 0,
      totalCost: 0,
      remaining: roundMoney(available),
    };
  }

  const shares = available.dividedBy(price).floor().toNumber();
  const totalCost = roundMoney(new Decimal(shares).times(price));
  const remaining = roundMoney(available.minus(totalCost));

  return {
    shares,
    totalCost,
    remaining: Math.max(remaining, 0),
  };
}
