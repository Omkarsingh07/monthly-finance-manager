// src/services/googleSheets.service.ts
import { getSheetsClient } from '../config/googleSheets';

export const SHEET_TABS = {
  INVESTMENT_PLAN: 'InvestmentPlan',
  SETTINGS: 'Settings',
  MONTHLY_INVESTMENTS: 'MonthlyInvestments',
  PLAN_HISTORY: 'PlanHistory',
} as const;

export const SHEET_HEADERS: Record<string, string[]> = {
  [SHEET_TABS.INVESTMENT_PLAN]: [
    'id',
    'name',
    'category',
    'weightage',
    'effectiveFromMonth',
    'effectiveFromYear',
    'planVersion',
    'createdAt',
    'updatedAt',
  ],
  [SHEET_TABS.SETTINGS]: [
    'key',
    'value',
    'updatedAt',
  ],
  [SHEET_TABS.MONTHLY_INVESTMENTS]: [
    'id',
    'planInvestmentId',
    'year',
    'month',
    'actualAmount',
    'createdAt',
    'updatedAt',
  ],
  [SHEET_TABS.PLAN_HISTORY]: [
    'planVersion',
    'monthlyInvestmentAmount',
    'effectiveFromMonth',
    'effectiveFromYear',
    'createdAt',
  ],
};

interface CacheEntry {
  timestamp: number;
  data: Array<{ rowIndex: number; values: string[] }>;
}

export class GoogleSheetsService {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL_MS = 2000; // 2 seconds TTL

  private invalidateCache(tabName?: string) {
    if (tabName) {
      this.cache.delete(tabName);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Tests connectivity and retrieves metadata about the configured Google Spreadsheet.
   */
  async checkHealth(): Promise<{
    connected: boolean;
    title?: string;
    tabs?: string[];
    error?: string;
  }> {
    try {
      const { sheets, spreadsheetId } = getSheetsClient();
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
      });

      const title = response.data.properties?.title ?? 'Untitled Spreadsheet';
      const tabs = (response.data.sheets ?? []).map((s) => s.properties?.title || '').filter(Boolean);

      return {
        connected: true,
        title,
        tabs,
      };
    } catch (err: any) {
      return {
        connected: false,
        error: err?.message || 'Failed to connect to Google Sheets',
      };
    }
  }

  /**
   * Ensures that all required tabs exist in the spreadsheet and have the correct headers.
   */
  async ensureSpreadsheetSchema(): Promise<void> {
    const { sheets, spreadsheetId } = getSheetsClient();

    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = meta.data.sheets || [];
    const existingTitles = new Set(
      existingSheets.map((s) => s.properties?.title).filter((t): t is string => Boolean(t))
    );

    // 1. Create missing sheets
    const sheetsToCreate = Object.values(SHEET_TABS).filter((tab) => !existingTitles.has(tab));
    if (sheetsToCreate.length > 0) {
      const requests = sheetsToCreate.map((title) => ({
        addSheet: {
          properties: {
            title,
          },
        },
      }));

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });
    }

    // 2. Ensure header rows are present for each required tab
    for (const [tabName, headers] of Object.entries(SHEET_HEADERS)) {
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A1:Z1`,
      });

      const currentHeaderRow = headerResponse.data.values?.[0];
      if (!currentHeaderRow || currentHeaderRow.length === 0) {
        // Write header row
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1:${String.fromCharCode(64 + headers.length)}1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [headers],
          },
        });
      }
    }
  }

  /**
   * Retrieves the numeric sheetId (gid) for a given tab name.
   */
  async getTabSheetId(tabName: string): Promise<number> {
    const { sheets, spreadsheetId } = getSheetsClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = (meta.data.sheets || []).find((s) => s.properties?.title === tabName);

    if (!sheet || sheet.properties?.sheetId === undefined || sheet.properties?.sheetId === null) {
      throw new Error(`Tab "${tabName}" not found in spreadsheet.`);
    }

    return sheet.properties.sheetId;
  }

  /**
   * Reads all data rows (excluding row 1 header) from a given tab with short TTL cache.
   * Returns an array of raw string arrays along with their 1-based rowIndex.
   */
  async readRawRows(tabName: string, forceFresh: boolean = false): Promise<Array<{ rowIndex: number; values: string[] }>> {
    const now = Date.now();
    const cached = this.cache.get(tabName);

    if (!forceFresh && cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    const { sheets, spreadsheetId } = getSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:Z`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    });

    const rows = response.data.values || [];
    const parsed = rows.map((row, idx) => ({
      rowIndex: idx + 2, // Row 1 is header, data starts at row 2
      values: row.map((v) => (v === null || v === undefined ? '' : String(v))),
    }));

    this.cache.set(tabName, { timestamp: now, data: parsed });
    return parsed;
  }

  /**
   * Appends a single row to a given tab.
   */
  async appendRow(tabName: string, rowValues: any[]): Promise<void> {
    this.invalidateCache(tabName);
    const { sheets, spreadsheetId } = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowValues],
      },
    });
  }

  /**
   * Appends multiple rows to a given tab in a single API call.
   */
  async appendRows(tabName: string, rowsValues: any[][]): Promise<void> {
    if (rowsValues.length === 0) return;
    this.invalidateCache(tabName);
    const { sheets, spreadsheetId } = getSheetsClient();

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${tabName}!A:A`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: rowsValues,
      },
    });
  }

  /**
   * Updates an entire row at a specific 1-based rowIndex.
   */
  async updateRow(tabName: string, rowIndex: number, rowValues: any[]): Promise<void> {
    this.invalidateCache(tabName);
    const { sheets, spreadsheetId } = getSheetsClient();
    const endColChar = String.fromCharCode(64 + Math.max(rowValues.length, 1));

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tabName}!A${rowIndex}:${endColChar}${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowValues],
      },
    });
  }

  /**
   * Clears all data rows in a tab (preserves header in row 1) in a single API call.
   */
  async clearDataRows(tabName: string): Promise<void> {
    this.invalidateCache(tabName);
    const { sheets, spreadsheetId } = getSheetsClient();

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${tabName}!A2:Z`,
    });
  }

  /**
   * Deletes a specific row by its 1-based rowIndex using deleteDimension.
   */
  async deleteRow(tabName: string, rowIndex: number): Promise<void> {
    this.invalidateCache(tabName);
    const { sheets, spreadsheetId } = getSheetsClient();
    const sheetId = await this.getTabSheetId(tabName);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // 0-based inclusive
                endIndex: rowIndex, // 0-based exclusive
              },
            },
          },
        ],
      },
    });
  }
}

export const googleSheetsService = new GoogleSheetsService();
