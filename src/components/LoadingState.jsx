import React from 'react';

export default function LoadingState({
  title = 'Processing request',
  detail = 'Running computation...',
  rows = 3,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6" role="status" aria-live="polite">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-9 w-full rounded-lg bg-slate-100 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
