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
        // Fresh user: start with 1 blank row
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
    fetchPlan();
  }, [fetchPlan]);

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
  const isValidAllocation = Math.abs(totalWeightage - 100) < 0.001;
  const remainingWeightage = Math.max(100 - totalWeightage, 0);

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
    <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8 animate-fadeIn">
      {/* 1. Page Title */}
      <div className="text-center pt-2 pb-1">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)] lowercase">
          setting
        </h1>
      </div>

      {loading && <LoadingState message="Loading plan configuration..." />}

      {!loading && (
        <form onSubmit={handleSave} className="space-y-6 sm:space-y-8">
          {error && <ErrorState message={error} />}

          {/* Success Banner */}
          {saveStatus === 'saved' && (
            <div className="p-4 rounded-2xl bg-[var(--success-subtle)] border border-[var(--success)]/20 text-[var(--success)] text-sm font-medium flex items-center justify-between shadow-xs animate-in fade-in duration-200">
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

          {/* 2. Top Two Input Cards Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Card: Your monthly plan */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs transition-colors flex flex-col justify-between">
              <div>
                <label
                  htmlFor="monthlyAmount"
                  className="block text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1"
                >
                  Your monthly plan
                </label>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Base amount to allocate every month
                </p>
              </div>

              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-base font-medium text-[var(--text-secondary)]">
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
                  placeholder="e.g. 5000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--text-tertiary)]"
                  required
                />
              </div>
            </div>

            {/* Right Card: Start date */}
            <div className="rounded-2xl sm:rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-xs transition-colors flex flex-col justify-between">
              <div>
                <span className="block text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1">
                  Start date
                </span>
                <p className="text-xs text-[var(--text-secondary)] mb-4">
                  Effective month &amp; year for this plan version
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="relative">
                  <select
                    id="effectiveMonth"
                    value={effectiveMonth}
                    onChange={(e) => {
                      setEffectiveMonth(parseInt(e.target.value, 10));
                      setSaveStatus('idle');
                    }}
                    disabled={saving}
                    aria-label="Effective Month"
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
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
                </div>

                <div className="relative">
                  <select
                    id="effectiveYear"
                    value={effectiveYear}
                    onChange={(e) => {
                      setEffectiveYear(parseInt(e.target.value, 10));
                      setSaveStatus('idle');
                    }}
                    disabled={saving}
                    aria-label="Effective Year"
                    className="w-full px-3 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
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

          {/* 3. Main Allocation Section (plane allocation) */}
          <div className="rounded-2xl sm:rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 sm:p-7 shadow-xs transition-colors space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] lowercase">
                  plane allocation
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Define investment assets and target weightage distribution
                </p>
              </div>

              {/* Status Badge */}
              <div className="text-right">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tabular-nums transition-colors ${
                    isValidAllocation
                      ? 'bg-[var(--success-subtle)] text-[var(--success)] border border-[var(--success)]/20'
                      : 'bg-[var(--warning-subtle)] text-[var(--warning)] border border-[var(--warning)]/20'
                  }`}
                >
                  {isValidAllocation
                    ? '100% Allocated ✓'
                    : `Total: ${totalWeightage}% (Remaining: ${remainingWeightage}%)`}
                </span>
              </div>
            </div>

            {/* Desktop Table Headers */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              <span className="col-span-6">Investment Name</span>
              <span className="col-span-3">Category</span>
              <span className="col-span-2 text-right">Weightage</span>
              <span className="col-span-1 text-center">Action</span>
            </div>

            {/* Investment Items List */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:grid sm:grid-cols-12 gap-2.5 sm:gap-3 p-3 sm:p-2.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] items-stretch sm:items-center transition-colors"
                >
                  {/* Name */}
                  <div className="sm:col-span-6">
                    <input
                      type="text"
                      placeholder="e.g. Nifty 50 ETF"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      disabled={saving}
                      aria-label="Investment Name"
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all placeholder:text-[var(--text-tertiary)]"
                      required
                    />
                  </div>

                  {/* Category */}
                  <div className="sm:col-span-3">
                    <select
                      value={item.category}
                      onChange={(e) =>
                        handleItemChange(index, 'category', e.target.value as InvestmentCategory)
                      }
                      disabled={saving}
                      aria-label="Category"
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option
                          key={cat}
                          value={cat}
                          className="bg-[var(--bg-surface)] text-[var(--text-primary)]"
                        >
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weightage */}
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
                      className="w-full px-3 py-2 pr-7 text-right font-semibold text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                      required
                    />
                    <span className="absolute right-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                      %
                    </span>
                  </div>

                  {/* Delete Action */}
                  <div className="sm:col-span-1 flex items-center justify-end sm:justify-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={saving || items.length <= 1}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-20 transition-colors cursor-pointer"
                      aria-label="Delete investment"
                      title="Delete investment"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Actions Row: Add Investment (Left) + Total & Save (Right) */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={handleAddItem}
                disabled={saving}
                className="inline-flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 rounded-xl text-sm font-medium text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] active:scale-[0.99] transition-all cursor-pointer border border-transparent hover:border-[var(--accent)]/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Investment</span>
              </button>

              <div className="flex items-center justify-between sm:justify-end gap-4">
                <span className="text-xs font-semibold tabular-nums text-[var(--text-secondary)]">
                  Total: {totalWeightage}%
                </span>

                <button
                  type="submit"
                  disabled={saving || !isValidAllocation}
                  className="px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <span>Saved ✓</span>
                  ) : (
                    <span>Save</span>
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
