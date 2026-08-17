// src/components/shared/EmptyState.tsx
import React from 'react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionText?: string;
  actionHref?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No investment plan configured',
  message = 'Configure your investment plan in Settings to start tracking your monthly investments.',
  actionText = 'Configure Investment Plan',
  actionHref = '/settings',
}) => {
  return (
    <div className="p-10 sm:p-14 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center shadow-xs space-y-5 transition-colors">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
          {message}
        </p>
      </div>

      {actionHref && (
        <div className="pt-2">
          <Link
            to={actionHref}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] transition-colors shadow-xs cursor-pointer"
          >
            <span>{actionText}</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
};
