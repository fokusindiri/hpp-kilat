import React from 'react';

interface InstagramCreditProps {
  className?: string;
  prefixText?: string;
}

export const InstagramCredit: React.FC<InstagramCreditProps> = ({
  className = '',
  prefixText,
}) => {
  return (
    <a
      href="https://www.instagram.com/sacademy.indonesia"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Instagram Sacademy Indonesia, buka di tab baru"
      className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-2 text-sm text-[var(--ink-primary)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-cobalt)] ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
      <span>
        {prefixText ? `${prefixText} ` : ''}@sacademy.indonesia
      </span>
    </a>
  );
};