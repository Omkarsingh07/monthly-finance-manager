// src/pages/Settings.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { getInvestmentPlan, saveInvestmentPlan } from '../api/investmentPlan';
import type { InvestmentCategory } from '../types/api';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';

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
    } catch (err: any) {
      console.error('[Settings] Failed to fetch investment plan:', err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          'Unable to load settings from server.'
      );
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
      }, 3000);
    } catch (err: any) {
      console.error('[Settings] Failed to save plan:', err);
      setError(
        err?.response?.data?.error ||
          err?.message ||
          'Failed to save investment plan.'
      );
    } finally {
      setSaving(false);
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 2022 + i);

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-fadeIn">
      {/* Page Header */}
      <div className="pb-2 border-b border-[var(--border-subtle)]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Configure your baseline monthly target and allocation plan
        </p>
      </div>

      {loading && <LoadingState message="Loading plan configuration..." />}

      {!loading && (
        <form onSubmit={handleSave} className="space-y-8">
          {error && <ErrorState message={error} />}

          {saveStatus === 'saved' && (
            <div className="p-4 rounded-2xl bg-[var(--success-subtle)] border border-[var(--success)]/30 text-[var(--success)] text-sm font-semibold flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>Investment plan saved successfully to Google Sheets!</span>
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

          {/* Section 1: Monthly Investment Budget */}
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card space-y-4 transition-colors">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                1. Monthly Investment Budget
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                The fixed base amount you plan to invest each month before carry-forward adjustments.
              </p>
            </div>

            <div className="max-w-xs">
              <label htmlFor="monthlyAmount" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                Base Monthly Target (₹)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-sm font-semibold text-[var(--text-secondary)]">
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
                  className="w-full pl-7 pr-3 py-2 text-sm font-semibold rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  placeholder="e.g. 5000"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Effective Period */}
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card space-y-4 transition-colors">
            <div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                2. Plan Effective Date
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                New plan updates will apply from this month onwards without altering past history.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <div>
                <label htmlFor="effectiveMonth" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Effective Month
                </label>
                <select
                  id="effectiveMonth"
                  value={effectiveMonth}
                  onChange={(e) => setEffectiveMonth(parseInt(e.target.value, 10))}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {MONTHS.map((m, idx) => (
                    <option key={m} value={idx + 1} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="effectiveYear" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  Effective Year
                </label>
                <select
                  id="effectiveYear"
                  value={effectiveYear}
                  onChange={(e) => setEffectiveYear(parseInt(e.target.value, 10))}
                  disabled={saving}
                  className="px-3 py-2 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  {years.map((y) => (
                    <option key={y} value={y} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Investment Plan Items & Allocations */}
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  3. Plan Allocation
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Define your target assets and their portfolio percentage (must equal 100%).
                </p>
              </div>

              {/* Status Badge */}
              <div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tabular-nums ${
                    isValidAllocation
                      ? 'bg-[var(--success-subtle)] text-[var(--success)]'
                      : 'bg-[var(--warning-subtle)] text-[var(--warning)]'
                  }`}
                >
                  {isValidAllocation ? `100% Allocated ✓` : `Total: ${totalWeightage}% (Must be 100%)`}
                </span>
              </div>
            </div>

            {/* List of Plan Items */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]"
                >
                  {/* Name Input */}
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Asset Name (e.g. Nifty 50 Index Fund)"
                      value={item.name}
                      onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                      disabled={saving}
                      aria-label="Asset Name"
                      className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      required
                    />
                  </div>

                  {/* Category Dropdown */}
                  <div className="w-full sm:w-36">
                    <select
                      value={item.category}
                      onChange={(e) =>
                        handleItemChange(index, 'category', e.target.value as InvestmentCategory)
                      }
                      disabled={saving}
                      aria-label="Category"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Weightage Input */}
                  <div className="w-full sm:w-32 flex items-center gap-1.5">
                    <div className="relative flex items-center w-full">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        step="any"
                        placeholder="50"
                        value={item.weightage === 0 ? '' : item.weightage}
                        onChange={(e) =>
                          handleItemChange(index, 'weightage', parseFloat(e.target.value) || 0)
                        }
                        disabled={saving}
                        aria-label="Weightage percentage"
                        className="w-full px-3 py-2 pr-7 text-right font-semibold text-sm rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        required
                      />
                      <span className="absolute right-2.5 text-xs font-semibold text-[var(--text-secondary)]">
                        %
                      </span>
                    </div>
                  </div>

                  {/* Delete Item Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    disabled={saving || items.length <= 1}
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger-subtle)] disabled:opacity-20 transition-colors cursor-pointer self-end sm:self-center"
                    aria-label="Remove item"
                    title="Remove item"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddItem}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-[var(--accent-text)] hover:bg-[var(--accent-subtle)] transition-colors cursor-pointer min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Investment Asset</span>
            </button>
          </div>

          {/* Bottom Save Action Ribbon */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <span className="text-xs text-[var(--text-secondary)]">
              {isValidAllocation
                ? 'Portfolio allocations equal 100%. Ready to save.'
                : `Total is currently ${totalWeightage}%. Must equal 100% to save.`}
            </span>

            <button
              type="submit"
              disabled={saving || !isValidAllocation}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium text-sm text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-40 transition-all shadow-xs cursor-pointer min-h-[44px] flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving Plan...</span>
                </>
              ) : saveStatus === 'saved' ? (
                <span>Plan Saved ✓</span>
              ) : (
                <span>Save Investment Plan</span>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
