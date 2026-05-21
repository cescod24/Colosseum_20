"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type Datum = { label: string; spend: number };

const fmtCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-CH", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);

export function SpendBar({
  data,
  currency,
}: {
  data: Datum[];
  currency: string;
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No spend yet — submit and approve a few orders to populate this chart.
      </p>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#52525b" }}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#52525b" }}
            tickFormatter={(v) =>
              new Intl.NumberFormat("en-CH", {
                notation: "compact",
                maximumFractionDigits: 0,
              }).format(v)
            }
          />
          <Tooltip
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            contentStyle={{ fontSize: 12 }}
            formatter={(v) => fmtCurrency(Number(v), currency)}
          />
          <Bar dataKey="spend" fill="#18181b" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
