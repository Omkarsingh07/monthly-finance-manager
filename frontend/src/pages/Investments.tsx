// src/pages/Investments.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getMonthlyInvestments, batchUpdateMonthlyInvestments } from '../api/monthlyInvestments';
import type { DashboardResponse } from '../types/api';
import { MonthYearSelector } from '../components/shared/MonthYearSelector';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';
import { EmptyState } from '../components/shared/EmptyState';
import { formatINR } from '../utils/format';
import { getErrorMessage } from '../utils/error';

export default function Investments() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [actualInputs, setActualInputs] = useState<Record<string, number>>({});
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchInvestments = useCallback(async (month: number, year: number) => {
    setLoading(true);
    setError(null);
    setSaveStatus('idle');
    try {
      const response = await getMonthlyInvestments(month, year);
      setData(response);

      const initialInputs: Record<string, number> = {};
      response.investments?.forEach((item) => {
        initialInputs[item.id] = item.actualAmount ?? 0;
      });
      setActualInputs(initialInputs);
      setInputErrors({});
    } catch (err: unknown) {
      console.error('[Investments] Failed to fetch monthly investments:', err);
      setError(getErrorMessage(err, 'Unable to load investments from server.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvestments(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchInvestments]);

  const handleInputChange = (id: string, value: string) => {
    setSaveStatus('idle');
    if (value === '') {
      setActualInputs((prev) => ({ ...prev, [id]: 0 }));
      setInputErrors((prev) => ({ ...prev, [id]: '' }));
      return;
    }

    const num = parseFloat(value);
    if (isNaN(num)) {
      setInputErrors((prev) => ({ ...prev, [id]: 'Please enter a valid number' }));
      return;
    }

    if (num < 0) {
      setInputErrors((prev) => ({ ...prev, [id]: 'Amount cannot be negative' }));
      return;
    }

    setInputErrors((prev) => ({ ...prev, [id]: '' }));
    setActualInputs((prev) => ({ ...prev, [id]: num }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !data.investments || data.investments.length === 0) return;

    // Validate inputs
    const hasNegative = Object.values(actualInputs).some((v) => v < 0);
    if (hasNegative) {
      setError('Actual investment amounts cannot be negative');
      return;
    }

    setSaving(true);
    setSaveStatus('saving');
    setError(null);

    try {
      const itemsToSave = data.investments.map((inv) => ({
        planInvestmentId: inv.id,
        actualAmount: actualInputs[inv.id] ?? 0,
      }));

      const res = await batchUpdateMonthlyInvestments({
        year: selectedYear,
        month: selectedMonth,
        investments: itemsToSave,
      });

      setData(res.breakdown);
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (err: unknown) {
      console.error('[Investments] Failed to save investments:', err);
      setError(getErrorMessage(err, 'Failed to save investments to Google Sheets.'));
      setSaveStatus('idle');
    } finally {
      setSaving(false);
    }
  };

  const totalActual = Object.values(actualInputs).reduce((sum, val) => sum + (val || 0), 0);
  const totalPlanned = data?.currentMonthTarget ?? 0;
  const remaining = Math.max(0, totalPlanned - totalActual);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header with Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Investments
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Track and record your actual monthly investment activity
          </p>
        </div>

        <MonthYearSelector
          month={selectedMonth}
          year={selectedYear}
          onChange={(m, y) => {
            setSelectedMonth(m);
            setSelectedYear(y);
          }}
          disabled={loading || saving}
        />
      </div>

      {loading && <LoadingState message="Loading monthly investments from Google Sheets..." />}

      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => fetchInvestments(selectedMonth, selectedYear)}
        />
      )}

      {!loading && !error && data && data.noPlan && (
        <EmptyState
          title="No investments configured yet"
          message="Configure your monthly investment plan in Settings first to start logging actual investments."
          actionText="Configure in Settings"
          actionHref="/settings"
        />
      )}

      {!loading && !error && data && !data.noPlan && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Monthly Target Summary Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card transition-colors">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                This Month Target
              </span>
              <p className="text-2xl font-bold text-[var(--text-primary)] mt-1 tabular-nums">
                {formatINR(data.currentMonthTarget)}
              </p>
              <span className="text-xs text-[var(--text-secondary)]">
                {formatINR(data.baseMonthlyAmount)} base + {formatINR(data.previousCarryForward)} carry
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Total Invested
              </span>
              <p className="text-2xl font-bold text-[var(--accent-text)] mt-1 tabular-nums">
                {formatINR(totalActual)}
              </p>
              <span className="text-xs text-[var(--text-secondary)]">
                Sum of current month actuals
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Remaining to Target
              </span>
              <p className="text-2xl font-bold text-[var(--text-secondary)] mt-1 tabular-nums">
                {formatINR(remaining)}
              </p>
              <span className="text-xs text-[var(--text-secondary)]">
                Target minus Actual
              </span>
            </div>
          </div>

          {/* Investment Items List / Cards */}
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">Record Actuals</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Enter the actual amounts invested for each asset
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                {data.investments?.length || 0} Items
              </span>
            </div>

            <div className="divide-y divide-[var(--border-subtle)]">
              {data.investments?.map((item) => {
                const itemError = inputErrors[item.id];
                const isItemDone = (actualInputs[item.id] ?? 0) >= item.plannedAmount && item.plannedAmount > 0;

                return (
                  <div
                    key={item.id}
                    className="p-5 sm:px-6 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[var(--bg-surface-subtle)]/40 transition-colors"
                  >
                    {/* Item Information */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-base text-[var(--text-primary)]">
                          {item.name}
                        </h3>
                        {isItemDone && (
                          <span className="text-xs font-semibold text-[var(--success)] bg-[var(--success-subtle)] px-2 py-0.5 rounded-md">
                            Done ✓
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                          {item.category}
                        </span>
                        <span>·</span>
                        <span className="font-medium tabular-nums">{item.weightage}% weightage</span>
                        <span>·</span>
                        <span className="font-medium">Planned: {formatINR(item.plannedAmount)}</span>
                      </div>
                    </div>

                    {/* Actual Amount Input Control */}
                    <div className="flex flex-col sm:items-end gap-1">
                      <div className="relative flex items-center">
                        <span className="absolute left-3 text-sm font-semibold text-[var(--text-secondary)]">
                          ₹
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={actualInputs[item.id] === undefined || actualInputs[item.id] === 0 ? '' : actualInputs[item.id]}
                          onChange={(e) => handleInputChange(item.id, e.target.value)}
                          disabled={saving}
                          placeholder="0.00"
                          aria-label={`Actual amount for ${item.name}`}
                          className={`w-full sm:w-44 pl-7 pr-3 py-2 text-right font-semibold text-sm rounded-xl border bg-[var(--bg-surface)] text-[var(--text-primary)] tabular-nums transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] ${
                            itemError
                              ? 'border-[var(--danger)] focus:ring-[var(--danger)]'
                              : 'border-[var(--border-strong)]'
                          }`}
                        />
                      </div>
                      {itemError && (
                        <span className="text-xs font-medium text-[var(--danger)]">
                          {itemError}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Action Footer */}
            <div className="px-6 py-4 bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <span className="text-xs text-[var(--text-secondary)]">
                Updates sync directly to your real Google Spreadsheet in real time.
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {saveStatus === 'saved' && (
                  <span className="text-xs font-semibold text-[var(--success)] flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved to Google Sheets
                  </span>
                )}

                <button
                  type="submit"
                  disabled={saving || Object.values(inputErrors).some(Boolean)}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 min-h-[44px]"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <span>Saved ✓</span>
                  ) : (
                    <span>Save Investments</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
