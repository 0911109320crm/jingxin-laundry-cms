"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";

type SourceDatum = {
  name: string;
  count: number;
  revenue: number;
  repurchaseRate: number;
};

const PIE_COLORS = [
  "#0ea5e9", // sky-500
  "#22c55e", // green-500
  "#f59e0b", // amber-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#14b8a6", // teal-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#ef4444", // red-500
];

export function SourcePie({ data }: { data: SourceDatum[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-zinc-500">本期間無資料</p>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, value }: { name?: string; value?: number }) =>
              `${name ?? ""} ${value ?? 0}`
            }
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [`${v} 筆`, "案件數"]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SourceRepurchaseBar({ data }: { data: SourceDatum[] }) {
  if (data.length === 0)
    return <p className="py-8 text-center text-sm text-zinc-500">本期間無資料</p>;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `${v}%`}
            domain={[0, 100]}
          />
          <Tooltip
            formatter={(v) => [`${v}%`, "回購率"]}
          />
          <Legend />
          <Bar dataKey="repurchaseRate" fill="#22c55e" name="回購率 (%)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
