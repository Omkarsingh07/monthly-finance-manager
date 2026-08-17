// src/components/shared/LoadingState.tsx
import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading financial data...' }) => {
  return (
    <div className="space-y-8 animate-fadeIn" role="status" aria-live="polite">
      {/* Skeleton Header Helper */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
        <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-ping"></div>
        <span>{message}</span>
      </div>

      {/* 3 Metric Cards Skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-3"
          >
            <div className="h-3 w-28 apple-skeleton"></div>
            <div className="h-8 w-40 apple-skeleton"></div>
            <div className="h-3 w-48 apple-skeleton"></div>
          </div>
        ))}
      </div>

      {/* Table / List Skeleton */}
      <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-4">
        <div className="h-5 w-44 apple-skeleton"></div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-[var(--border-subtle)]">
              <div className="space-y-2">
                <div className="h-4 w-48 apple-skeleton"></div>
                <div className="h-3 w-20 apple-skeleton"></div>
              </div>
              <div className="h-5 w-24 apple-skeleton"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
