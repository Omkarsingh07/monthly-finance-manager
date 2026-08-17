// src/services/monthlyInvestment.service.ts
import { googleSheetsService, SHEET_TABS } from './googleSheets.service';
import { investmentPlanService } from './investmentPlan.service';
import { MonthlyInvestmentRecord, PlanHistoryRecord, InvestmentPlanRecord } from '../types/sheets';
import { roundMoney, sumMoney, calculatePlannedAllocations } from '../utils/money';
import { v4 as uuidv4 } from 'uuid';

export interface MonthlyInvestmentItem {
  id: string; // planInvestmentId
  name: string;
  category: string;
  weightage: number;
  normalPlannedAmount: number;
  previousMonthPending: number;
  plannedAmount: number;
  actualAmount: number;
}

export interface MonthlyBreakdownResponse {
  noPlan: boolean;
  message?: string;
  month: number;
  year: number;
  baseMonthlyAmount: number;
  previousCarryForward: number;
  currentMonthTarget: number;
  currentMonthActual: number;
  currentMonthRemaining: number;
  investments: MonthlyInvestmentItem[];
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
   * Recursively computes investment-level targets and pending amounts in-memory using pre-fetched datasets.
   * Tracking per planInvestmentId ensures each investment carries over its own pending amount.
   */
  private computeInvestmentTargetsInMemory(
    month: number,
    year: number,
    allMonthly: Array<{ rowIndex: number; record: MonthlyInvestmentRecord }>,
    histories: PlanHistoryRecord[],
    allPlanItems: Array<{ rowIndex: number; record: InvestmentPlanRecord }>,
    visited: Set<string> = new Set()
  ): Map<string, { normalPlannedAmount: number; previousMonthPending: number; plannedAmount: number }> {
    const key = `${year}-${month}`;
    if (visited.has(key)) {
      return new Map();
    }
    visited.add(key);

    const activePlan = this.resolveActivePlanInMemory(month, year, histories, allPlanItems);
    if (!activePlan || activePlan.investments.length === 0) {
      return new Map();
    }

    // 1. Calculate normal planned allocation for this month
    const normalAllocationsMap = calculatePlannedAllocations(activePlan.monthlyAmount, activePlan.investments);

    const prev = this.getPreviousMonthRef(month, year);
    const prevPlan = this.resolveActivePlanInMemory(prev.month, prev.year, histories, allPlanItems);

    const result = new Map<string, { normalPlannedAmount: number; previousMonthPending: number; plannedAmount: number }>();

    // Check if there is any history on or before previous month
    const hasHistory = allMonthly.some(
      (m) =>
        m.record.year < prev.year ||
        (m.record.year === prev.year && m.record.month <= prev.month)
    );

    if (!prevPlan || !hasHistory) {
      // Base case: No previous month history or plan
      for (const item of activePlan.investments) {
        const normal = normalAllocationsMap.get(item.id) ?? 0;
        result.set(item.id, {
          normalPlannedAmount: normal,
          previousMonthPending: 0,
          plannedAmount: normal,
        });
      }
      return result;
    }

    // 2. Recursively resolve previous month's investment-level targets
    const prevTargetsMap = this.computeInvestmentTargetsInMemory(
      prev.month,
      prev.year,
      allMonthly,
      histories,
      allPlanItems,
      visited
    );

    // Map previous month actual investments by planInvestmentId
    const prevActualsMap = new Map<string, number>();
    allMonthly
      .filter((m) => m.record.year === prev.year && m.record.month === prev.month)
      .forEach((m) => {
        prevActualsMap.set(m.record.planInvestmentId, m.record.actualAmount);
      });

    // 3. For each active investment item, calculate investment-level pending and target
    for (const item of activePlan.investments) {
      const normal = normalAllocationsMap.get(item.id) ?? 0;
      const prevTargetInfo = prevTargetsMap.get(item.id);

      let pending = 0;
      if (prevTargetInfo) {
        const prevPlanned = prevTargetInfo.plannedAmount;
        const prevActual = prevActualsMap.get(item.id) ?? 0;
        // Pending = MAX(Previous Planned - Previous Actual, 0)
        pending = Math.max(roundMoney(prevPlanned - prevActual), 0);
      }

      const totalPlanned = roundMoney(normal + pending);
      result.set(item.id, {
        normalPlannedAmount: normal,
        previousMonthPending: pending,
        plannedAmount: totalPlanned,
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
   * Retrieves complete monthly breakdown with calculated target, planned amounts, and actuals.
   */
  async getMonthlyBreakdown(month: number, year: number): Promise<MonthlyBreakdownResponse> {
    const [allMonthly, histories, allPlanItems] = await Promise.all([
      this.getAllMonthlyInvestments(),
      investmentPlanService.getPlanHistories(),
      investmentPlanService.getAllPlanItems(),
    ]);

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
        currentMonthActual: 0,
        currentMonthRemaining: 0,
        investments: [],
      };
    }

    // Compute investment-level targets with individual carry-forward
    const targetMap = this.computeInvestmentTargetsInMemory(
      month,
      year,
      allMonthly,
      histories,
      allPlanItems
    );

    const baseMonthlyAmount = activePlan.monthlyAmount;

    const currentMonthRecords = allMonthly.filter(
      (m) => m.record.year === year && m.record.month === month
    );

    const actualMap = new Map<string, number>();
    currentMonthRecords.forEach((m) => {
      actualMap.set(m.record.planInvestmentId, m.record.actualAmount);
    });

    const investments: MonthlyInvestmentItem[] = activePlan.investments.map((planItem) => {
      const targetInfo = targetMap.get(planItem.id) ?? {
        normalPlannedAmount: 0,
        previousMonthPending: 0,
        plannedAmount: 0,
      };
      const actual = actualMap.get(planItem.id) ?? 0;

      return {
        id: planItem.id,
        name: planItem.name,
        category: planItem.category,
        weightage: planItem.weightage,
        normalPlannedAmount: targetInfo.normalPlannedAmount,
        previousMonthPending: targetInfo.previousMonthPending,
        plannedAmount: targetInfo.plannedAmount,
        actualAmount: actual,
      };
    });

    const previousCarryForward = sumMoney(investments.map((i) => i.previousMonthPending));
    const currentMonthTarget = sumMoney(investments.map((i) => i.plannedAmount));
    const currentMonthActual = sumMoney(investments.map((i) => i.actualAmount));
    const currentMonthRemaining = Math.max(roundMoney(currentMonthTarget - currentMonthActual), 0);

    return {
      noPlan: false,
      month,
      year,
      baseMonthlyAmount,
      previousCarryForward,
      currentMonthTarget,
      currentMonthActual,
      currentMonthRemaining,
      investments,
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
   * Batch upserts actual investments for a month/year.
   */
  async batchUpsertActualAmounts(
    year: number,
    month: number,
    items: Array<{ planInvestmentId: string; actualAmount: number }>
  ): Promise<MonthlyBreakdownResponse> {
    for (const item of items) {
      await this.upsertActualAmount(item.planInvestmentId, year, month, item.actualAmount);
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
