import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function ConfidenceChart({ probabilities = [], threshold = 70 }) {
  const data = probabilities.map((item, idx) => ({
    code: item.code,
    fullName: item.fullName,
    percentage: Number(item.percentage ?? (item.probability * 100).toFixed(2)),
    isTop: idx === 0,
  }));

  if (!data.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        No class probability distribution available yet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 12, fill: '#64748b', fontFamily: 'JetBrains Mono' }}
            />
            <YAxis
              type="category"
              dataKey="code"
              width={48}
              tick={{ fontSize: 12, fill: '#0f172a', fontWeight: 600, fontFamily: 'JetBrains Mono' }}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toFixed(2)}%`, 'CNN Softmax Score']}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            <ReferenceLine
              x={threshold}
              stroke="#d97706"
              strokeDasharray="4 4"
              label={{
                value: `${threshold}% gate`,
                position: 'top',
                fill: '#b45309',
                fontSize: 11,
              }}
            />
            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={22}>
              {data.map((entry) => (
                <Cell
                  key={entry.code}
                  fill={entry.isTop ? (entry.percentage >= threshold ? '#2563eb' : '#d97706') : '#94a3b8'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-2 pr-4 font-medium">Class</th>
              <th className="py-2 pr-4 font-medium">Condition Name</th>
              <th className="py-2 text-right font-medium">Softmax Probability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => (
              <tr key={row.code} className="hover:bg-slate-50">
                <td className="py-2 pr-4 font-mono font-semibold text-slate-900">{row.code}</td>
                <td className="py-2 pr-4 text-slate-700">{row.fullName}</td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                  {row.percentage.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
