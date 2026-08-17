// src/components/shared/ErrorState.tsx
import React from 'react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to load your financial data.',
  onRetry,
}) => {
  return (
    <div
      className="p-8 rounded-2xl bg-[var(--danger-subtle)] border border-[var(--danger)]/20 text-center space-y-4 shadow-xs"
      role="alert"
    >
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-[var(--danger)]/15 text-[var(--danger)]">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Connection Issue</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">{message}</p>
      </div>

      {onRetry && (
        <div>
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors shadow-xs cursor-pointer inline-flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
};
