// src/services/investmentPlan.service.ts
import { googleSheetsService, SHEET_TABS } from './googleSheets.service';
import { InvestmentPlanRecord, PlanHistoryRecord, InvestmentCategory } from '../types/sheets';
import { SaveInvestmentPlanInput, PlanInvestmentItemInput } from '../validators/investmentPlan.validator';
import { v4 as uuidv4 } from 'uuid';

export class InvestmentPlanService {
  /**
   * Reads a single setting by key from the Settings sheet.
   */
  async getSetting(key: string): Promise<string | null> {
    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
    const row = rawRows.find((r) => r.values[0] === key);
    return row && row.values[1] !== undefined ? row.values[1] : null;
  }

  /**
   * Sets or updates a setting in the Settings sheet.
   */
  async setSetting(key: string, value: string): Promise<void> {
    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.SETTINGS);
    const found = rawRows.find((r) => r.values[0] === key);
    const now = new Date().toISOString();

    if (found) {
      await googleSheetsService.updateRow(SHEET_TABS.SETTINGS, found.rowIndex, [key, value, now]);
    } else {
      await googleSheetsService.appendRow(SHEET_TABS.SETTINGS, [key, value, now]);
    }
  }

  /**
   * Retrieves all PlanHistory records from Google Sheets.
   */
  async getPlanHistories(): Promise<PlanHistoryRecord[]> {
    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.PLAN_HISTORY);
    return rawRows.map((r) => ({
      planVersion: parseInt(r.values[0] || '1', 10),
      monthlyInvestmentAmount: parseFloat(r.values[1] || '0'),
      effectiveFromMonth: parseInt(r.values[2] || '1', 10),
      effectiveFromYear: parseInt(r.values[3] || '2000', 10),
      createdAt: r.values[4] || '',
    }));
  }

  /**
   * Retrieves all InvestmentPlan records from Google Sheets.
   */
  async getAllPlanItems(): Promise<Array<{ rowIndex: number; record: InvestmentPlanRecord }>> {
    const rawRows = await googleSheetsService.readRawRows(SHEET_TABS.INVESTMENT_PLAN);
    return rawRows.map((r) => ({
      rowIndex: r.rowIndex,
      record: {
        id: r.values[0] || '',
        name: r.values[1] || '',
        category: (r.values[2] || 'OTHER') as InvestmentCategory,
        weightage: parseFloat(r.values[3] || '0'),
        effectiveFromMonth: parseInt(r.values[4] || '1', 10),
        effectiveFromYear: parseInt(r.values[5] || '2000', 10),
        planVersion: parseInt(r.values[6] || '1', 10),
        createdAt: r.values[7] || '',
        updatedAt: r.values[8] || '',
      },
    }));
  }

  /**
   * Finds the active plan version for a specific (month, year).
   * Follows the rule: most recent plan version effective on or before target (month, year).
   */
  async getActivePlan(
    targetMonth?: number,
    targetYear?: number
  ): Promise<{
    planVersion: number;
    monthlyAmount: number;
    effectiveFromMonth: number;
    effectiveFromYear: number;
    investments: InvestmentPlanRecord[];
  } | null> {
    const histories = await this.getPlanHistories();
    const allPlanItemsWithRows = await this.getAllPlanItems();

    if (allPlanItemsWithRows.length === 0 && histories.length === 0) {
      return null;
    }

    const m = targetMonth ?? new Date().getMonth() + 1;
    const y = targetYear ?? new Date().getFullYear();

    // Sort histories by effective date descending
    const sortedHistories = [...histories].sort((a, b) => {
      if (a.effectiveFromYear !== b.effectiveFromYear) {
        return b.effectiveFromYear - a.effectiveFromYear;
      }
      if (a.effectiveFromMonth !== b.effectiveFromMonth) {
        return b.effectiveFromMonth - a.effectiveFromMonth;
      }
      return b.planVersion - a.planVersion;
    });

    // Find the latest history with effective date <= target (y, m)
    let activeHistory = sortedHistories.find((h) => {
      if (h.effectiveFromYear < y) return true;
      if (h.effectiveFromYear === y && h.effectiveFromMonth <= m) return true;
      return false;
    });

    // If target is earlier than any configured history, fallback to the earliest history
    if (!activeHistory && sortedHistories.length > 0) {
      activeHistory = sortedHistories[sortedHistories.length - 1];
    }

    let activeVersion = activeHistory ? activeHistory.planVersion : 1;
    let monthlyAmount = activeHistory ? activeHistory.monthlyInvestmentAmount : 0;
    let effectiveFromMonth = activeHistory ? activeHistory.effectiveFromMonth : m;
    let effectiveFromYear = activeHistory ? activeHistory.effectiveFromYear : y;

    // If no history row existed, try reading monthlyAmount from Settings
    if (!activeHistory) {
      const settingVal = await this.getSetting('monthlyInvestmentAmount');
      if (settingVal) {
        monthlyAmount = parseFloat(settingVal);
      }
    }

    // Filter items belonging to activeVersion
    let matchingItems = allPlanItemsWithRows
      .map((item) => item.record)
      .filter((r) => r.planVersion === activeVersion && r.id);

    // Fallback: If no items match exact version, check for any items with valid weightage
    if (matchingItems.length === 0 && allPlanItemsWithRows.length > 0) {
      const latestVersion = Math.max(...allPlanItemsWithRows.map((i) => i.record.planVersion || 1));
      matchingItems = allPlanItemsWithRows
        .map((item) => item.record)
        .filter((r) => r.planVersion === latestVersion && r.id);
      activeVersion = latestVersion;
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
   * Saves or creates a new version of the investment plan.
   * Ensures 100% total weightage, updates Settings, PlanHistory, and InvestmentPlan sheets.
   */
  async savePlan(input: SaveInvestmentPlanInput): Promise<{
    planVersion: number;
    monthlyAmount: number;
    effectiveFromMonth: number;
    effectiveFromYear: number;
    investments: InvestmentPlanRecord[];
  }> {
    const now = new Date().toISOString();
    const histories = await this.getPlanHistories();
    const allPlanItemsWithRows = await this.getAllPlanItems();

    // Check if there is an existing plan with the exact same effectiveFromMonth and effectiveFromYear
    const existingHistory = histories.find(
      (h) =>
        h.effectiveFromMonth === input.effectiveFromMonth &&
        h.effectiveFromYear === input.effectiveFromYear
    );

    let planVersion: number;

    if (existingHistory) {
      // Overwrite/update existing version for this exact month/year
      planVersion = existingHistory.planVersion;

      // Update PlanHistory row
      const rawHistories = await googleSheetsService.readRawRows(SHEET_TABS.PLAN_HISTORY);
      const historyRow = rawHistories.find(
        (r) => parseInt(r.values[0], 10) === planVersion
      );
      if (historyRow) {
        await googleSheetsService.updateRow(SHEET_TABS.PLAN_HISTORY, historyRow.rowIndex, [
          planVersion,
          input.monthlyAmount,
          input.effectiveFromMonth,
          input.effectiveFromYear,
          historyRow.values[4] || now,
        ]);
      }

      // Remove existing plan items for this version in reverse order to keep row indices stable
      const itemsToDelete = allPlanItemsWithRows
        .filter((item) => item.record.planVersion === planVersion)
        .sort((a, b) => b.rowIndex - a.rowIndex);

      for (const item of itemsToDelete) {
        await googleSheetsService.deleteRow(SHEET_TABS.INVESTMENT_PLAN, item.rowIndex);
      }
    } else {
      // Create a brand new plan version
      const maxVersion = histories.reduce((max, h) => Math.max(max, h.planVersion), 0);
      planVersion = maxVersion + 1;

      // Append new PlanHistory row
      await googleSheetsService.appendRow(SHEET_TABS.PLAN_HISTORY, [
        planVersion,
        input.monthlyAmount,
        input.effectiveFromMonth,
        input.effectiveFromYear,
        now,
      ]);
    }

    // Always keep current monthlyInvestmentAmount in Settings sheet up-to-date
    await this.setSetting('monthlyInvestmentAmount', String(input.monthlyAmount));

    // Prepare rows for InvestmentPlan sheet
    const savedInvestments: InvestmentPlanRecord[] = input.investments.map(
      (item: PlanInvestmentItemInput) => {
        const id = item.id && item.id.trim() !== '' ? item.id : `pi_${uuidv4().substring(0, 8)}`;
        return {
          id,
          name: item.name,
          category: item.category,
          weightage: item.weightage,
          effectiveFromMonth: input.effectiveFromMonth,
          effectiveFromYear: input.effectiveFromYear,
          planVersion,
          createdAt: now,
          updatedAt: now,
        };
      }
    );

    const rowsToAppend = savedInvestments.map((inv) => [
      inv.id,
      inv.name,
      inv.category,
      inv.weightage,
      inv.effectiveFromMonth,
      inv.effectiveFromYear,
      inv.planVersion,
      inv.createdAt,
      inv.updatedAt,
    ]);

    await googleSheetsService.appendRows(SHEET_TABS.INVESTMENT_PLAN, rowsToAppend);

    return {
      planVersion,
      monthlyAmount: input.monthlyAmount,
      effectiveFromMonth: input.effectiveFromMonth,
      effectiveFromYear: input.effectiveFromYear,
      investments: savedInvestments,
    };
  }

  /**
   * Deletes a specific investment item by its ID from the active plan.
   * Note: Total weightage must be rebalanced to 100% when deleting items in normal plan flow.
   */
  async deletePlanItem(id: string): Promise<boolean> {
    const allPlanItemsWithRows = await this.getAllPlanItems();
    const item = allPlanItemsWithRows.find((i) => i.record.id === id);
    if (!item) {
      return false;
    }
    await googleSheetsService.deleteRow(SHEET_TABS.INVESTMENT_PLAN, item.rowIndex);
    return true;
  }
}

export const investmentPlanService = new InvestmentPlanService();
