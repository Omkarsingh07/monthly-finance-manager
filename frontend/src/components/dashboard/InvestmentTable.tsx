// src/components/dashboard/InvestmentTable.tsx
import React from 'react';
import type { MonthlyInvestmentItem } from '../../types/api';
import { formatINR } from '../../utils/format';

interface InvestmentTableProps {
  investments: MonthlyInvestmentItem[];
  totalPlanned: number;
  totalActual: number;
  remaining: number;
}

export const InvestmentTable: React.FC<InvestmentTableProps> = ({
  investments,
  totalPlanned,
  totalActual,
  remaining,
}) => {
  return (
    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-card overflow-hidden transition-colors">
      {/* Table Header / Title */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Investment Breakdown</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Planned monthly target allocation vs actual invested amounts
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
          {investments.length} Assets
        </span>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] text-xs font-medium border-b border-[var(--border-subtle)]">
            <tr>
              <th className="px-6 py-3.5">Investment</th>
              <th className="px-6 py-3.5">Category</th>
              <th className="px-6 py-3.5 text-right">Weightage</th>
              <th className="px-6 py-3.5 text-right">Planned</th>
              <th className="px-6 py-3.5 text-right">Actual</th>
              <th className="px-6 py-3.5 text-right">Remaining</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {investments.map((item) => {
              const itemRemaining = Math.max(0, item.plannedAmount - item.actualAmount);
              const isItemComplete = item.actualAmount >= item.plannedAmount && item.plannedAmount > 0;

              return (
                <tr key={item.id} className="hover:bg-[var(--bg-surface-subtle)]/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                    {item.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-medium rounded-md bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-[var(--text-secondary)] tabular-nums font-medium">
                    {item.weightage}%
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-[var(--text-primary)] tabular-nums">
                    {formatINR(item.plannedAmount)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                    {formatINR(item.actualAmount)}
                  </td>
                  <td className="px-6 py-4 text-right tabular-nums">
                    {isItemComplete ? (
                      <span className="text-xs font-semibold text-[var(--success)]">
                        Done ✓
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--text-secondary)]">
                        {formatINR(itemRemaining)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[var(--bg-surface-subtle)] border-t border-[var(--border-subtle)] font-medium">
            <tr>
              <td className="px-6 py-4 font-semibold text-[var(--text-primary)]" colSpan={2}>
                Total
              </td>
              <td className="px-6 py-4 text-right text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                100%
              </td>
              <td className="px-6 py-4 text-right font-bold text-[var(--text-primary)] tabular-nums">
                {formatINR(totalPlanned)}
              </td>
              <td className="px-6 py-4 text-right font-bold text-[var(--accent-text)] tabular-nums">
                {formatINR(totalActual)}
              </td>
              <td className="px-6 py-4 text-right font-bold text-[var(--text-secondary)] tabular-nums">
                {formatINR(remaining)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile Stacked Cards View */}
      <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
        {investments.map((item) => {
          const itemRemaining = Math.max(0, item.plannedAmount - item.actualAmount);
          const isItemComplete = item.actualAmount >= item.plannedAmount && item.plannedAmount > 0;

          return (
            <div key={item.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-sm text-[var(--text-primary)]">{item.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
                      {item.category}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] font-medium tabular-nums">
                      {item.weightage}% weightage
                    </span>
                  </div>
                </div>

                {isItemComplete && (
                  <span className="text-xs font-semibold text-[var(--success)] bg-[var(--success-subtle)] px-2 py-0.5 rounded-md">
                    Done ✓
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                <div>
                  <span className="text-[var(--text-secondary)]">Planned</span>
                  <p className="font-semibold text-[var(--text-primary)] mt-0.5 tabular-nums">
                    {formatINR(item.plannedAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Actual</span>
                  <p className="font-semibold text-[var(--accent-text)] mt-0.5 tabular-nums">
                    {formatINR(item.actualAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Remaining</span>
                  <p className="font-semibold text-[var(--text-secondary)] mt-0.5 tabular-nums">
                    {formatINR(itemRemaining)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Mobile Total Card */}
        <div className="p-4 bg-[var(--bg-surface-subtle)] space-y-2">
          <div className="flex justify-between items-center text-sm font-semibold text-[var(--text-primary)]">
            <span>Total Target</span>
            <span className="tabular-nums">{formatINR(totalPlanned)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
            <span>Total Invested</span>
            <span className="font-semibold text-[var(--accent-text)] tabular-nums">{formatINR(totalActual)}</span>
          </div>
          <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
            <span>Total Remaining</span>
            <span className="font-semibold tabular-nums">{formatINR(remaining)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
