// src/components/dashboard/SummaryCards.tsx
import React from 'react';
import { formatINR } from '../../utils/format';

interface SummaryCardsProps {
  totalInvestment: number;
  currentMonthTarget: number;
  currentMonthRemaining: number;
  baseMonthlyAmount: number;
  previousCarryForward: number;
  currentMonthActual: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalInvestment,
  currentMonthTarget,
  currentMonthRemaining,
  baseMonthlyAmount,
  previousCarryForward,
  currentMonthActual,
}) => {
  const isCompleted = currentMonthRemaining === 0 && currentMonthActual > 0;
  const isOverTarget = currentMonthActual > currentMonthTarget;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* 1. Total Investment Card */}
      <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card transition-all hover:border-[var(--border-strong)]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Total Investment
          </p>
          <div className="w-2 h-2 rounded-full bg-[var(--text-tertiary)] opacity-60"></div>
        </div>

        <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
          {formatINR(totalInvestment)}
        </p>

        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          All-time actual purchases across all history
        </p>
      </div>

      {/* 2. This Month Target Investment Card */}
      <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card transition-all hover:border-[var(--border-strong)]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            This Month Investment
          </p>
          <div className="w-2 h-2 rounded-full bg-[var(--accent)]"></div>
        </div>

        <p className="mt-3 text-3xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
          {formatINR(baseMonthlyAmount || currentMonthTarget)}
        </p>

        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {previousCarryForward > 0
            ? `Monthly SIP (+ ${formatINR(previousCarryForward)} accumulated pending)`
            : 'Fixed monthly SIP allocation'}
        </p>
      </div>

      {/* 3. This Month Remaining Card */}
      <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card transition-all hover:border-[var(--border-strong)]">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            This Month Remaining
          </p>
          {isCompleted ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--success-subtle)] text-[var(--success)]">
              {isOverTarget ? 'Over Target' : 'Completed ✓'}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-[var(--accent-subtle)] text-[var(--accent-text)]">
              Pending
            </span>
          )}
        </div>

        <p
          className={`mt-3 text-3xl font-bold tracking-tight tabular-nums ${
            isCompleted
              ? 'text-[var(--success)]'
              : 'text-[var(--text-primary)]'
          }`}
        >
          {formatINR(currentMonthRemaining)}
        </p>

        <p className="mt-2 text-xs text-[var(--text-secondary)]">
          {formatINR(currentMonthActual)} invested this month
        </p>
      </div>
    </div>
  );
};
