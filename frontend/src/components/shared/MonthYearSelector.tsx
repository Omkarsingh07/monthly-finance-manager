// src/components/shared/MonthYearSelector.tsx
import React from 'react';

const MONTH_NAMES = [
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

interface MonthYearSelectorProps {
  month: number;
  year: number;
  onChange: (month: number, year: number) => void;
  disabled?: boolean;
}

export const MonthYearSelector: React.FC<MonthYearSelectorProps> = ({
  month,
  year,
  onChange,
  disabled = false,
}) => {
  const handlePrev = () => {
    if (month === 1) {
      onChange(12, year - 1);
    } else {
      onChange(month - 1, year);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      onChange(1, year + 1);
    } else {
      onChange(month + 1, year);
    }
  };

  const years = Array.from({ length: 11 }, (_, i) => 2022 + i);

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs transition-colors">
      {/* Previous Month Button */}
      <button
        type="button"
        onClick={handlePrev}
        disabled={disabled}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-30 transition-colors cursor-pointer"
        aria-label="Previous Month"
        title="Previous Month"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Month & Year Dropdowns */}
      <div className="flex items-center gap-1 px-1">
        <select
          value={month}
          disabled={disabled}
          onChange={(e) => onChange(parseInt(e.target.value, 10), year)}
          className="text-sm font-semibold text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer py-1 px-1.5 rounded hover:bg-[var(--bg-surface-subtle)] transition-colors"
          aria-label="Select month"
        >
          {MONTH_NAMES.map((name, idx) => (
            <option key={name} value={idx + 1} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
              {name}
            </option>
          ))}
        </select>

        <select
          value={year}
          disabled={disabled}
          onChange={(e) => onChange(month, parseInt(e.target.value, 10))}
          className="text-sm font-semibold text-[var(--text-primary)] bg-transparent focus:outline-none cursor-pointer py-1 px-1.5 rounded hover:bg-[var(--bg-surface-subtle)] transition-colors"
          aria-label="Select year"
        >
          {years.map((y) => (
            <option key={y} value={y} className="bg-[var(--bg-surface)] text-[var(--text-primary)]">
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Next Month Button */}
      <button
        type="button"
        onClick={handleNext}
        disabled={disabled}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-30 transition-colors cursor-pointer"
        aria-label="Next Month"
        title="Next Month"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
