// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import { getDashboard } from '../api/dashboard';
import type { DashboardResponse } from '../types/api';
import { SummaryCards } from '../components/dashboard/SummaryCards';
import { InvestmentTable } from '../components/dashboard/InvestmentTable';
import { MonthYearSelector } from '../components/shared/MonthYearSelector';
import { LoadingState } from '../components/shared/LoadingState';
import { ErrorState } from '../components/shared/ErrorState';
import { EmptyState } from '../components/shared/EmptyState';
import { getErrorMessage } from '../utils/error';

export default function Dashboard() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async (month: number, year: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await getDashboard(month, year);
      setData(response);
    } catch (err: unknown) {
      console.error('[Dashboard] Failed to fetch dashboard:', err);
      setError(getErrorMessage(err, 'Unable to load your financial data from server.'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(selectedMonth, selectedYear);
  }, [selectedMonth, selectedYear, fetchDashboard]);

  const handleMonthYearChange = (newMonth: number, newYear: number) => {
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Page Header with Month/Year Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--border-subtle)]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Overview of your monthly investment performance and allocation
          </p>
        </div>

        <MonthYearSelector
          month={selectedMonth}
          year={selectedYear}
          onChange={handleMonthYearChange}
          disabled={loading}
        />
      </div>

      {/* Main Content Areas */}
      {loading && <LoadingState message="Connecting to Google Sheets..." />}

      {!loading && error && (
        <ErrorState
          message={error}
          onRetry={() => fetchDashboard(selectedMonth, selectedYear)}
        />
      )}

      {!loading && !error && data && data.noPlan && (
        <EmptyState
          title="No investment plan yet"
          message="Create your investment plan to start tracking your monthly investments."
          actionText="Configure Investment Plan"
          actionHref="/settings"
        />
      )}

      {!loading && !error && data && !data.noPlan && (
        <div className="space-y-8">
          {/* Top 3 Metric Cards */}
          <SummaryCards
            totalInvestment={data.totalInvestment}
            currentMonthTarget={data.currentMonthTarget}
            currentMonthRemaining={data.currentMonthRemaining}
            baseMonthlyAmount={data.baseMonthlyAmount}
            previousCarryForward={data.previousCarryForward}
            currentMonthActual={data.currentMonthActual}
          />

          {/* Current Month Investment Breakdown */}
          <InvestmentTable
            investments={data.investments}
            totalPlanned={data.currentMonthTarget}
            totalActual={data.currentMonthActual}
            remaining={data.currentMonthRemaining}
          />
        </div>
      )}
    </div>
  );
}
