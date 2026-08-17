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
   * Recursively computes carry forward in-memory using pre-fetched datasets.
   * Eliminates unnecessary Google Sheets API roundtrips.
   */
  private computeCarryForwardInMemory(
    month: number,
    year: number,
    allMonthly: Array<{ rowIndex: number; record: MonthlyInvestmentRecord }>,
    histories: PlanHistoryRecord[],
    allPlanItems: Array<{ rowIndex: number; record: InvestmentPlanRecord }>,
    visited: Set<string> = new Set()
  ): number {
    const key = `${year}-${month}`;
    if (visited.has(key)) return 0;
    visited.add(key);

    const prev = this.getPreviousMonthRef(month, year);
    const prevPlan = this.resolveActivePlanInMemory(prev.month, prev.year, histories, allPlanItems);

    if (!prevPlan) {
      return 0; // No plan existed in previous month
    }

    // Check if there is any history on or before prev month
    const hasHistory = allMonthly.some(
      (m) =>
        m.record.year < prev.year ||
        (m.record.year === prev.year && m.record.month <= prev.month)
    );

    if (!hasHistory) {
      return 0;
    }

    const prevCarryForward = this.computeCarryForwardInMemory(
      prev.month,
      prev.year,
      allMonthly,
      histories,
      allPlanItems,
      visited
    );

    const prevTarget = roundMoney(prevPlan.monthlyAmount + prevCarryForward);
    const prevRecords = allMonthly.filter(
      (m) => m.record.year === prev.year && m.record.month === prev.month
    );
    const prevActual = sumMoney(prevRecords.map((m) => m.record.actualAmount));

    return Math.max(roundMoney(prevTarget - prevActual), 0);
  }

  /**
   * Calculates carry forward for a given month and year from Google Sheets data.
   */
  async calculateCarryForward(month: number, year: number): Promise<number> {
    const [allMonthly, histories, allPlanItems] = await Promise.all([
      this.getAllMonthlyInvestments(),
      investmentPlanService.getPlanHistories(),
      investmentPlanService.getAllPlanItems(),
    ]);

    return this.computeCarryForwardInMemory(month, year, allMonthly, histories, allPlanItems);
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

    const previousCarryForward = this.computeCarryForwardInMemory(
      month,
      year,
      allMonthly,
      histories,
      allPlanItems
    );
    const baseMonthlyAmount = activePlan.monthlyAmount;
    const currentMonthTarget = roundMoney(baseMonthlyAmount + previousCarryForward);

    // Planned amounts calculated from currentMonthTarget * weightage / 100
    const plannedMap = calculatePlannedAllocations(currentMonthTarget, activePlan.investments);

    const currentMonthRecords = allMonthly.filter(
      (m) => m.record.year === year && m.record.month === month
    );

    const actualMap = new Map<string, number>();
    currentMonthRecords.forEach((m) => {
      actualMap.set(m.record.planInvestmentId, m.record.actualAmount);
    });

    const investments: MonthlyInvestmentItem[] = activePlan.investments.map((planItem) => {
      const planned = plannedMap.get(planItem.id) ?? 0;
      const actual = actualMap.get(planItem.id) ?? 0;
      return {
        id: planItem.id,
        name: planItem.name,
        category: planItem.category,
        weightage: planItem.weightage,
        plannedAmount: planned,
        actualAmount: actual,
      };
    });

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
