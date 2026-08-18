// src/services/monthlyInvestment.service.ts
import { googleSheetsService, SHEET_TABS } from './googleSheets.service';
import { investmentPlanService } from './investmentPlan.service';
import { MonthlyInvestmentRecord, PlanHistoryRecord, InvestmentPlanRecord } from '../types/sheets';
import { roundMoney, sumMoney, calculatePlannedAllocations, calculateWholeShares } from '../utils/money';
import { v4 as uuidv4 } from 'uuid';

export interface MonthlyInvestmentItem {
  id: string; // planInvestmentId
  name: string;
  category: string;
  weightage: number;
  monthlyAllocation: number;     // Current month's base SIP allocation (S * weightage / 100)
  previousPending: number;       // Accumulated pending balance from previous months for THIS investment
  availableAmount: number;       // monthlyAllocation + previousPending
  currentPrice?: number;         // Current unit/share price if provided
  sharesToBuy?: number;          // Whole units/shares to buy: floor(availableAmount / currentPrice)
  plannedPurchaseAmount?: number;// sharesToBuy * currentPrice
  actualAmount: number;          // Actual amount invested this month
  pendingAmount: number;         // Resulting pending balance: availableAmount - actualAmount (>= 0)

  // Backward-compatibility aliases for existing callers
  normalPlannedAmount: number;   // alias for monthlyAllocation
  previousMonthPending: number;  // alias for previousPending
  plannedAmount: number;         // alias for availableAmount
}

export interface MonthlyBreakdownResponse {
  noPlan: boolean;
  message?: string;
  month: number;
  year: number;
  baseMonthlyAmount: number;     // Configured monthly SIP amount (e.g. ₹2,000)
  previousCarryForward: number;  // Total accumulated previous pending across all investments
  currentMonthTarget: number;    // Configured monthly SIP target (e.g. ₹2,000)
  totalAvailableAmount: number;  // Total available across all investments (base + carry)
  currentMonthActual: number;    // Sum of actual investments this month
  currentMonthRemaining: number; // Sum of pending/remaining balances this month
  investments: MonthlyInvestmentItem[];
}

export interface InvestmentTargetState {
  monthlyAllocation: number;
  previousPending: number;
  availableAmount: number;
  actualAmount: number;
  pendingAmount: number;
}

export class MonthlyInvestmentService {
  /**
   * Reads all MonthlyInvestments rows from Google Sheets.
   */
  async getAllMonthlyInvestments(): Promise<Array<{ rowIndex: number; record: MonthlyInvestmentRecord }>> {
    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.MONTHLY_INVESTMENTS);
    return rawRows.map((r) => ({
      rowIndex: r.rowIndex,
      record: {
        id: r.values[0] || '',
        planInvestmentId: r.values[1] || '',
        year: parseInt(r.values[2] || '2000', 10),
        month: parseInt(r.values[3] || '1', 10),
        actualAmount: parseFloat(r.values[4] || '0'),
        createdAt: r.values[5] || '',
        updatedAt: r.values[6] || '',
      },
    }));
  }

  /**
   * Helper to get previous month and year reference.
   */
  getPreviousMonthRef(month: number, year: number): { month: number; year: number } {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }
    return { month: month - 1, year };
  }

  /**
   * Resolves active plan in-memory for given (targetMonth, targetYear) from pre-fetched histories & items.
   */
  private resolveActivePlanInMemory(
    targetMonth: number,
    targetYear: number,
    histories: PlanHistoryRecord[],
    allPlanItems: Array<{ rowIndex: number; record: InvestmentPlanRecord }>
  ): {
    planVersion: number;
    monthlyAmount: number;
    effectiveFromMonth: number;
    effectiveFromYear: number;
    investments: InvestmentPlanRecord[];
  } | null {
    if (histories.length === 0 && allPlanItems.length === 0) {
      return null;
    }

    const sortedHistories = [...histories].sort((a, b) => {
      if (a.effectiveFromYear !== b.effectiveFromYear) {
        return b.effectiveFromYear - a.effectiveFromYear;
      }
      if (a.effectiveFromMonth !== b.effectiveFromMonth) {
        return b.effectiveFromMonth - a.effectiveFromMonth;
      }
      return b.planVersion - a.planVersion;
    });

    let activeHistory = sortedHistories.find((h) => {
      if (h.effectiveFromYear < targetYear) return true;
      if (h.effectiveFromYear === targetYear && h.effectiveFromMonth <= targetMonth) return true;
      return false;
    });

    if (!activeHistory && sortedHistories.length > 0) {
      activeHistory = sortedHistories[sortedHistories.length - 1];
    }

    const activeVersion = activeHistory ? activeHistory.planVersion : 1;
    const monthlyAmount = activeHistory ? activeHistory.monthlyInvestmentAmount : 0;
    const effectiveFromMonth = activeHistory ? activeHistory.effectiveFromMonth : targetMonth;
    const effectiveFromYear = activeHistory ? activeHistory.effectiveFromYear : targetYear;

    let matchingItems = allPlanItems
      .map((item) => item.record)
      .filter((r) => r.planVersion === activeVersion && r.id);

    if (matchingItems.length === 0 && allPlanItems.length > 0) {
      const latestVersion = Math.max(...allPlanItems.map((i) => i.record.planVersion || 1));
      matchingItems = allPlanItems
        .map((item) => item.record)
        .filter((r) => r.planVersion === latestVersion && r.id);
    }

    if (matchingItems.length === 0) {
      return null;
    }

    return {
      planVersion: activeVersion,
      monthlyAmount,
      effectiveFromMonth,
      effectiveFromYear,
      investments: matchingItems,
    };
  }

  /**
   * Recursively computes stock-wise allocation, accumulated pending balance, and available amount.
   * Every investment's pending balance is strictly isolated and accumulates across historical months.
   */
  private computeStockWiseStateInMemory(
    month: number,
    year: number,
    allMonthly: Array<{ rowIndex: number; record: MonthlyInvestmentRecord }>,
    histories: PlanHistoryRecord[],
    allPlanItems: Array<{ rowIndex: number; record: InvestmentPlanRecord }>,
    visited: Set<string> = new Set()
  ): Map<string, InvestmentTargetState> {
    const key = `${year}-${month}`;
    if (visited.has(key)) {
      return new Map();
    }
    visited.add(key);

    const activePlan = this.resolveActivePlanInMemory(month, year, histories, allPlanItems);
    if (!activePlan || activePlan.investments.length === 0) {
      return new Map();
    }

    // 1. Calculate normal monthly SIP allocation for each asset
    const normalAllocationsMap = calculatePlannedAllocations(activePlan.monthlyAmount, activePlan.investments);

    const prev = this.getPreviousMonthRef(month, year);
    const prevPlan = this.resolveActivePlanInMemory(prev.month, prev.year, histories, allPlanItems);

    const result = new Map<string, InvestmentTargetState>();

    // Current month actuals mapped by planInvestmentId
    const currentActualsMap = new Map<string, number>();
    allMonthly
      .filter((m) => m.record.year === year && m.record.month === month)
      .forEach((m) => {
        currentActualsMap.set(m.record.planInvestmentId, m.record.actualAmount);
      });

    // Check if there is any history on or before previous month
    const hasPriorHistory = allMonthly.some(
      (m) =>
        m.record.year < prev.year ||
        (m.record.year === prev.year && m.record.month <= prev.month)
    );

    if (!prevPlan || !hasPriorHistory) {
      // Base case: First active month (no prior history)
      for (const item of activePlan.investments) {
        const allocation = normalAllocationsMap.get(item.id) ?? 0;
        const actual = currentActualsMap.get(item.id) ?? 0;
        const pending = Math.max(roundMoney(allocation - actual), 0);

        result.set(item.id, {
          monthlyAllocation: allocation,
          previousPending: 0,
          availableAmount: allocation,
          actualAmount: actual,
          pendingAmount: pending,
        });
      }
      return result;
    }

    // 2. Recursively resolve previous month's stock-wise state
    const prevStockStateMap = this.computeStockWiseStateInMemory(
      prev.month,
      prev.year,
      allMonthly,
      histories,
      allPlanItems,
      visited
    );

    // 3. For each active investment item, calculate available amount and new pending balance
    for (const item of activePlan.investments) {
      const allocation = normalAllocationsMap.get(item.id) ?? 0;
      const prevPending = prevStockStateMap.get(item.id)?.pendingAmount ?? 0;

      const available = roundMoney(allocation + prevPending);
      const actual = currentActualsMap.get(item.id) ?? 0;
      const newPending = Math.max(roundMoney(available - actual), 0);

      result.set(item.id, {
        monthlyAllocation: allocation,
        previousPending: prevPending,
        availableAmount: available,
        actualAmount: actual,
        pendingAmount: newPending,
      });
    }

    return result;
  }

  /**
   * Calculates carry forward for a given month and year from Google Sheets data.
   */
  async calculateCarryForward(month: number, year: number): Promise<number> {
    const breakdown = await this.getMonthlyBreakdown(month, year);
    return breakdown.previousCarryForward;
  }

  /**
   * Retrieves complete monthly breakdown with stock-wise SIP allocations and accumulated pending balances.
   * Accepts optional share price map for whole-share purchase calculations.
   */
  async getMonthlyBreakdown(
    month: number,
    year: number,
    priceMap?: Map<string, number>
  ): Promise<MonthlyBreakdownResponse> {
    const batchMap = await googleSheetsService.batchReadRawRows([
      SHEET_TABS.MONTHLY_INVESTMENTS,
      SHEET_TABS.PLAN_HISTORY,
      SHEET_TABS.INVESTMENT_PLAN,
    ]);

    const monthlyRows = batchMap.get(SHEET_TABS.MONTHLY_INVESTMENTS) || [];
    const historyRows = batchMap.get(SHEET_TABS.PLAN_HISTORY) || [];
    const planRows = batchMap.get(SHEET_TABS.INVESTMENT_PLAN) || [];

    const allMonthly = monthlyRows.map((r) => ({
      rowIndex: r.rowIndex,
      record: {
        id: r.values[0] || '',
        planInvestmentId: r.values[1] || '',
        year: parseInt(r.values[2] || '2000', 10),
        month: parseInt(r.values[3] || '1', 10),
        actualAmount: parseFloat(r.values[4] || '0'),
        createdAt: r.values[5] || '',
        updatedAt: r.values[6] || '',
      },
    }));

    const histories: PlanHistoryRecord[] = historyRows.map((r) => ({
      planVersion: parseInt(r.values[0] || '1', 10),
      monthlyInvestmentAmount: parseFloat(r.values[1] || '0'),
      effectiveFromMonth: parseInt(r.values[2] || '1', 10),
      effectiveFromYear: parseInt(r.values[3] || '2000', 10),
      createdAt: r.values[4] || '',
    }));

    const allPlanItems = planRows.map((r) => ({
      rowIndex: r.rowIndex,
      record: {
        id: r.values[0] || '',
        name: r.values[1] || '',
        category: (r.values[2] || 'OTHER') as any,
        weightage: parseFloat(r.values[3] || '0'),
        effectiveFromMonth: parseInt(r.values[4] || '1', 10),
        effectiveFromYear: parseInt(r.values[5] || '2000', 10),
        planVersion: parseInt(r.values[6] || '1', 10),
        createdAt: r.values[7] || '',
        updatedAt: r.values[8] || '',
      },
    }));

    const activePlan = this.resolveActivePlanInMemory(month, year, histories, allPlanItems);

    if (!activePlan || activePlan.investments.length === 0) {
      return {
        noPlan: true,
        message: 'No investment plan configured for this period.',
        month,
        year,
        baseMonthlyAmount: 0,
        previousCarryForward: 0,
        currentMonthTarget: 0,
        totalAvailableAmount: 0,
        currentMonthActual: 0,
        currentMonthRemaining: 0,
        investments: [],
      };
    }

    // Compute stock-wise allocation and accumulated pending balances
    const stockStateMap = this.computeStockWiseStateInMemory(
      month,
      year,
      allMonthly,
      histories,
      allPlanItems
    );

    const baseMonthlyAmount = activePlan.monthlyAmount;

    const investments: MonthlyInvestmentItem[] = activePlan.investments.map((planItem) => {
      const state = stockStateMap.get(planItem.id) ?? {
        monthlyAllocation: 0,
        previousPending: 0,
        availableAmount: 0,
        actualAmount: 0,
        pendingAmount: 0,
      };

      const unitPrice = priceMap?.get(planItem.id) ?? priceMap?.get(planItem.name);
      let sharesToBuy: number | undefined;
      let plannedPurchaseAmount: number | undefined;

      if (unitPrice && unitPrice > 0) {
        const wholeShareInfo = calculateWholeShares(state.availableAmount, unitPrice);
        sharesToBuy = wholeShareInfo.shares;
        plannedPurchaseAmount = wholeShareInfo.totalCost;
      }

      return {
        id: planItem.id,
        name: planItem.name,
        category: planItem.category,
        weightage: planItem.weightage,
        monthlyAllocation: state.monthlyAllocation,
        previousPending: state.previousPending,
        availableAmount: state.availableAmount,
        currentPrice: unitPrice,
        sharesToBuy,
        plannedPurchaseAmount,
        actualAmount: state.actualAmount,
        pendingAmount: state.pendingAmount,

        // Aliases for backward compatibility
        normalPlannedAmount: state.monthlyAllocation,
        previousMonthPending: state.previousPending,
        plannedAmount: state.availableAmount,
      };
    });

    const previousCarryForward = sumMoney(investments.map((i) => i.previousPending));
    const currentMonthTarget = baseMonthlyAmount;
    const totalAvailableAmount = sumMoney(investments.map((i) => i.availableAmount));
    const currentMonthActual = sumMoney(investments.map((i) => i.actualAmount));
    const currentMonthRemaining = sumMoney(investments.map((i) => i.pendingAmount));

    return {
      noPlan: false,
      month,
      year,
      baseMonthlyAmount,
      previousCarryForward,
      currentMonthTarget,
      totalAvailableAmount,
      currentMonthActual,
      currentMonthRemaining,
      investments,
    };
  }

  /**
   * Retrieves complete dashboard payload (breakdown + total investment)
   * in a SINGLE Google Sheets batch read round-trip.
   */
  async getDashboardData(month: number, year: number): Promise<{
    breakdown: MonthlyBreakdownResponse;
    totalInvestment: number;
  }> {
    const batchMap = await googleSheetsService.batchReadRawRows([
      SHEET_TABS.MONTHLY_INVESTMENTS,
      SHEET_TABS.PLAN_HISTORY,
      SHEET_TABS.INVESTMENT_PLAN,
    ]);

    const monthlyRows = batchMap.get(SHEET_TABS.MONTHLY_INVESTMENTS) || [];
    const allMonthly = monthlyRows.map((r) => ({
      rowIndex: r.rowIndex,
      record: {
        id: r.values[0] || '',
        planInvestmentId: r.values[1] || '',
        year: parseInt(r.values[2] || '2000', 10),
        month: parseInt(r.values[3] || '1', 10),
        actualAmount: parseFloat(r.values[4] || '0'),
        createdAt: r.values[5] || '',
        updatedAt: r.values[6] || '',
      },
    }));

    const totalInvestment = sumMoney(allMonthly.map((m) => m.record.actualAmount));
    const breakdown = await this.getMonthlyBreakdown(month, year);

    return {
      breakdown,
      totalInvestment,
    };
  }

  /**
   * Upserts a single monthly actual investment amount in Google Sheets.
   * Guarantees uniqueness for (planInvestmentId, year, month).
   */
  async upsertActualAmount(
    planInvestmentId: string,
    year: number,
    month: number,
    actualAmount: number
  ): Promise<MonthlyInvestmentRecord> {
    const roundedAmount = roundMoney(actualAmount);
    const now = new Date().toISOString();

    const allMonthly = await this.getAllMonthlyInvestments();
    const existing = allMonthly.find(
      (m) =>
        m.record.planInvestmentId === planInvestmentId &&
        m.record.year === year &&
        m.record.month === month
    );

    if (existing) {
      // Update existing row
      const updatedRecord: MonthlyInvestmentRecord = {
        ...existing.record,
        actualAmount: roundedAmount,
        updatedAt: now,
      };

      await googleSheetsService.updateRow(SHEET_TABS.MONTHLY_INVESTMENTS, existing.rowIndex, [
        updatedRecord.id,
        updatedRecord.planInvestmentId,
        updatedRecord.year,
        updatedRecord.month,
        updatedRecord.actualAmount,
        updatedRecord.createdAt,
        updatedRecord.updatedAt,
      ]);

      return updatedRecord;
    } else {
      // Create new row with stable ID
      const newId = `mi_${uuidv4().substring(0, 8)}`;
      const newRecord: MonthlyInvestmentRecord = {
        id: newId,
        planInvestmentId,
        year,
        month,
        actualAmount: roundedAmount,
        createdAt: now,
        updatedAt: now,
      };

      await googleSheetsService.appendRow(SHEET_TABS.MONTHLY_INVESTMENTS, [
        newRecord.id,
        newRecord.planInvestmentId,
        newRecord.year,
        newRecord.month,
        newRecord.actualAmount,
        newRecord.createdAt,
        newRecord.updatedAt,
      ]);

      return newRecord;
    }
  }

  /**
   * Batch upserts actual investments for a month/year in minimal Google Sheets API calls.
   */
  async batchUpsertActualAmounts(
    year: number,
    month: number,
    items: Array<{ planInvestmentId: string; actualAmount: number }>
  ): Promise<MonthlyBreakdownResponse> {
    const allMonthly = await this.getAllMonthlyInvestments();
    const now = new Date().toISOString();
    const updatesToMake: Array<{ rowIndex: number; rowValues: any[] }> = [];
    const rowsToAppend: any[][] = [];

    for (const item of items) {
      const roundedAmount = roundMoney(item.actualAmount);
      const existing = allMonthly.find(
        (m) =>
          m.record.planInvestmentId === item.planInvestmentId &&
          m.record.year === year &&
          m.record.month === month
      );

      if (existing) {
        updatesToMake.push({
          rowIndex: existing.rowIndex,
          rowValues: [
            existing.record.id,
            existing.record.planInvestmentId,
            year,
            month,
            roundedAmount,
            existing.record.createdAt,
            now,
          ],
        });
      } else {
        const newId = `mi_${uuidv4().substring(0, 8)}`;
        rowsToAppend.push([
          newId,
          item.planInvestmentId,
          year,
          month,
          roundedAmount,
          now,
          now,
        ]);
      }
    }

    if (updatesToMake.length > 0) {
      await googleSheetsService.batchUpdateRows(SHEET_TABS.MONTHLY_INVESTMENTS, updatesToMake);
    }
    if (rowsToAppend.length > 0) {
      await googleSheetsService.appendRows(SHEET_TABS.MONTHLY_INVESTMENTS, rowsToAppend);
    }

    return this.getMonthlyBreakdown(month, year);
  }

  /**
   * Computes Total Actual Investment across all history in Google Sheets.
   * Total Investment = SUM(all actual amounts in MonthlyInvestments sheet).
   */
  async getTotalActualInvestment(): Promise<number> {
    const allMonthly = await this.getAllMonthlyInvestments();
    return sumMoney(allMonthly.map((m) => m.record.actualAmount));
  }

  /**
   * Deletes a monthly investment row by its record ID.
   */
  async deleteMonthlyRecord(id: string): Promise<boolean> {
    const allMonthly = await this.getAllMonthlyInvestments();
    const found = allMonthly.find((m) => m.record.id === id);
    if (!found) return false;
    await googleSheetsService.deleteRow(SHEET_TABS.MONTHLY_INVESTMENTS, found.rowIndex);
    return true;
  }
}

export const monthlyInvestmentService = new MonthlyInvestmentService();
