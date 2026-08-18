// src/pages/Settings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getInvestmentPlan, saveInvestmentPlan } from '../api/investmentPlan';
import type { InvestmentCategory } from '../types/api';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';
import { getErrorMessage } from '../utils/error';

interface EditablePlanItem {
  id?: string;
  name: string;
  category: InvestmentCategory;
  weightage: number;
}

const CATEGORIES: InvestmentCategory[] = ['STOCK', 'ETF', 'MUTUAL_FUND', 'OTHER'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function Settings() {
  const now = new Date();
  const [monthlyAmount, setMonthlyAmount] = useState<number>(0);
  const [effectiveMonth, setEffectiveMonth] = useState<number>(now.getMonth() + 1);
  const [effectiveYear, setEffectiveYear] = useState<number>(now.getFullYear());
  const [items, setItems] = useState<EditablePlanItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getInvestmentPlan();
      if (!response.noPlan && response.investments && response.investments.length > 0) {
        setMonthlyAmount(response.monthlyAmount ?? 0);
        setEffectiveMonth(response.effectiveFromMonth ?? now.getMonth() + 1);
        setEffectiveYear(response.effectiveFromYear ?? now.getFullYear());
        setItems(
          response.investments.map((i) => ({
            id: i.id,
            name: i.name,
            category: i.category,
            weightage: i.weightage,
          }))
        );
      } else {
        // Fresh user default
        setMonthlyAmount(0);
        setItems([{ name: '', category: 'ETF', weightage: 0 }]);
      }
    } catch (err: unknown) {
      console.error('[Settings] Failed to fetch investment plan:', err);
      setError(getErrorMessage(err, 'Unable to load settings from server.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getInvestmentPlan();
        if (!isCancelled) {
          if (!response.noPlan && response.investments && response.investments.length > 0) {
            setMonthlyAmount(response.monthlyAmount ?? 0);
            setEffectiveMonth(response.effectiveFromMonth ?? now.getMonth() + 1);
            setEffectiveYear(response.effectiveFromYear ?? now.getFullYear());
            setItems(
              response.investments.map((i) => ({
                id: i.id,
                name: i.name,
                category: i.category,
                weightage: i.weightage,
              }))
            );
          } else {
            // Fresh user default
            setMonthlyAmount(0);
            setItems([{ name: '', category: 'ETF', weightage: 0 }]);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('[Settings] Failed to fetch investment plan:', err);
          setError(getErrorMessage(err, 'Unable to load settings from server.'));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { name: '', category: 'ETF', weightage: 0 }]);
    setSaveStatus('idle');
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setSaveStatus('idle');
  };

  const handleItemChange = (
    index: number,
    field: keyof EditablePlanItem,
    value: string | number
  ) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return updated;
    });
    setSaveStatus('idle');
  };

  const totalWeightage = items.reduce((sum, item) => sum + (Number(item.weightage) || 0), 0);
  const roundedTotal = Math.round(totalWeightage * 100) / 100;
  const isValidAllocation = Math.abs(totalWeightage - 100) < 0.001;
  const remainingWeightage = Math.round(Math.max(100 - totalWeightage, 0) * 100) / 100;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAllocation) {
      setError('Total allocation weightage must equal exactly 100%');
      return;
    }

    if (items.some((i) => !i.name.trim())) {
      setError('All investment items must have a valid name');
      return;
    }

    if (monthlyAmount <= 0) {
      setError('Monthly investment amount must be greater than 0');
      return;
    }

    setSaving(true);
    setError(null);
    setSaveStatus('idle');

    try {
      await saveInvestmentPlan({
        monthlyAmount: Number(monthlyAmount),
        effectiveFromMonth: Number(effectiveMonth),
        effectiveFromYear: Number(effectiveYear),
        investments: items.map((i) => ({
          id: i.id,
          name: i.name.trim(),
          category: i.category,
          weightage: Number(i.weightage),
        })),
      });

      setSaveStatus('saved');
      await fetchPlan();
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3500);
    } catch (err: unknown) {
      console.error('[Settings] Failed to save plan:', err);
      setError(getErrorMessage(err, 'Failed to save investment plan.'));
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 2022 + i);

  return (
    <div className="max-w-5xl mx-auto w-full space-y-8 animate-fadeIn pb-12">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your monthly investment plan and asset allocation.
          </p>
        </div>

        {/* Live Allocation Summary Badge */}
        {!loading && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold tabular-nums border transition-colors ${
                isValidAllocation
                  ? 'bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success)]/20'
                  : 'bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning)]/20'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isValidAllocation ? 'bg-[var(--success)]' : 'bg-[var(--warning)]'
                }`}
              />
              {isValidAllocation
                ? '100% Allocated'
                : `${roundedTotal}% Allocated (${remainingWeightage}% remaining)`}
            </span>
          </div>
        )}
      </div>

      {loading && <LoadingState message="Loading plan configuration..." />}

      {!loading && (
        <form onSubmit={handleSave} className="space-y-8">
          {error && <ErrorState message={error} />}

          {/* Success Banner */}
          {saveStatus === 'saved' && (
            <div className="p-4 rounded-xl bg-[var(--success-subtle)] border border-[var(--success)]/20 text-[var(--success)] text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Investment plan saved successfully to Google Sheets</span>
              </div>
              <button
                type="button"
                onClick={() => setSaveStatus('idle')}
                className="text-xs font-semibold hover:underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 2. Plan Configuration Section */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs transition-colors space-y-6">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                Plan configuration
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Set the amount you want to invest every month and when this plan version becomes active.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[var(--border-subtle)]">
              {/* Monthly Investment Input */}
              <div className="space-y-2">
                <label
                  htmlFor="monthlyAmount"
                  className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider"
                >
                  Monthly investment
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3.5 text-sm font-semibold text-[var(--text-secondary)]">
                    ₹
                  </span>
                  <input
                    id="monthlyAmount"
                    type="number"
                    min="1"
                    step="any"
                    value={monthlyAmount === 0 ? '' : monthlyAmount}
                    onChange={(e) => {
                      setMonthlyAmount(parseFloat(e.target.value) || 0);
                      setSaveStatus('idle');
                    }}
                    disabled={saving}
                    placeholder="5000"
                    className="w-full h-11 pl-8 pr-4 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--text-tertiary)]"
                    required
                  />
                </div>
              </div>

              {/* Start Date Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider">
                  Start date
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <select
                    id="effectiveMonth"
                    value={effectiveMonth}
                    onChange={(e) => {
                      setEffectiveMonth(parseInt(e.target.value, 10));
                      setSaveStatus('idle');
                    }}
                    disabled={saving}
                    aria-label="Effective Month"
                    className="w-full h-11 px-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
                  >
                    {MONTHS.map((m, idx) => (
                      <option
                        key={m}
                        value={idx + 1}
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    id="effectiveYear"
                    value={effectiveYear}
                    onChange={(e) => {
                      setEffectiveYear(parseInt(e.target.value, 10));
                      setSaveStatus('idle');
                    }}
                    disabled={saving}
                    aria-label="Effective Year"
                    className="w-full h-11 px-3 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
                  >
                    {years.map((y) => (
                      <option
                        key={y}
                        value={y}
                        className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                      >
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Investment Allocation Section */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs transition-colors overflow-hidden">
            {/* Section Header & Progress Bar */}
            <div className="p-6 border-b border-[var(--border-subtle)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
                    Investment allocation
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Distribute your monthly investment across your selected assets.
                  </p>
                </div>

                <div className="text-right">
                  <span
                    className={`text-xs font-semibold tabular-nums ${
                      isValidAllocation ? 'text-[var(--success)]' : 'text-[var(--warning)]'
                    }`}
                  >
                    {isValidAllocation
                      ? '100% Allocated'
                      : `${roundedTotal}% Allocated · ${remainingWeightage}% Remaining`}
                  </span>
                </div>
              </div>

              {/* Polished Allocation Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-[var(--bg-surface-subtle)] overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isValidAllocation
                      ? 'bg-[var(--success)]'
                      : roundedTotal > 100
                      ? 'bg-[var(--danger)]'
                      : 'bg-[var(--accent)]'
                  }`}
                  style={{ width: `${Math.min(roundedTotal, 100)}%` }}
                />
              </div>
            </div>

            {/* Investment Items Table */}
            {items.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  No investments added
                </p>
                <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
                  Add your first investment to start building your target asset allocation.
                </p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-[var(--accent-text)] bg-[var(--accent-subtle)] hover:bg-[var(--accent)] hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add Investment</span>
                </button>
              </div>
            ) : (
              <div>
                {/* Desktop Column Headers */}
                <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-6 py-3 bg-[var(--bg-surface-subtle)]/60 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] border-b border-[var(--border-subtle)]">
                  <span className="col-span-6">Investment</span>
                  <span className="col-span-3">Category</span>
                  <span className="col-span-2 text-right">Weightage</span>
                  <span className="col-span-1 text-center">Actions</span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-[var(--border-subtle)]">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 sm:px-6 sm:py-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-3 items-stretch sm:items-center hover:bg-[var(--bg-surface-subtle)]/40 transition-colors"
                    >
                      {/* Name Field */}
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          placeholder="Investment name (e.g. Nifty 50 ETF)"
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          disabled={saving}
                          aria-label="Investment Name"
                          className="w-full h-10 px-3 text-sm font-medium rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--text-tertiary)]"
                          required
                        />
                      </div>

                      {/* Category Dropdown */}
                      <div className="sm:col-span-3">
                        <select
                          value={item.category}
                          onChange={(e) =>
                            handleItemChange(index, 'category', e.target.value as InvestmentCategory)
                          }
                          disabled={saving}
                          aria-label="Category"
                          className="w-full h-10 px-3 text-xs font-medium uppercase tracking-wider rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
                        >
                          {CATEGORIES.map((cat) => (
                            <option
                              key={cat}
                              value={cat}
                              className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                            >
                              {cat.replace('_', ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Weightage Input */}
                      <div className="sm:col-span-2 relative flex items-center">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="any"
                          placeholder="25"
                          value={item.weightage === 0 ? '' : item.weightage}
                          onChange={(e) =>
                            handleItemChange(index, 'weightage', parseFloat(e.target.value) || 0)
                          }
                          disabled={saving}
                          aria-label="Weightage percentage"
                          className="w-full h-10 px-3 pr-7 text-right font-semibold text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                          required
                        />
                        <span className="absolute right-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                          %
                        </span>
                      </div>

                      {/* Delete Action Button */}
                      <div className="sm:col-span-1 flex items-center justify-end sm:justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={saving || items.length <= 1}
                          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-20 transition-colors cursor-pointer"
                          aria-label="Delete investment item"
                          title="Delete item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table Footer: Add Action */}
                <div className="p-4 sm:px-6 bg-[var(--bg-surface-subtle)]/30 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add investment</span>
                  </button>

                  <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                    Total: {roundedTotal}%
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. Bottom Save Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {isValidAllocation
                ? 'All asset allocations are balanced and ready to save.'
                : `Total allocation must equal 100% to save changes (currently ${roundedTotal}%).`}
            </span>

            <button
              type="submit"
              disabled={saving || !isValidAllocation}
              className="px-6 py-2.5 rounded-lg font-medium text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving changes...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <span>Changes saved ✓</span>
              ) : (
                <span>Save changes</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
