import React from 'react';

export default function DashboardCard({
  title,
  subtitle = null,
  action = null,
  children,
  className = '',
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold text-slate-900 leading-snug">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
