"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";

type ChartSpec = {
  type: "table" | "line" | "bar" | "area" | "pie" | "number";
  x?: string | null;
  y?: string[];
  grouping?: string | null;
  title?: string;
  options?: Record<string, unknown>;
};

export function ChartRenderer({ spec, rows }: { spec: ChartSpec; rows: any[] }) {
  if (!spec || spec.type === "table") return null;
  const data = rows ?? [];
  const xKey = spec.x ?? (data.length > 0 ? Object.keys(data[0])[0] : undefined);
  const yKeys = (spec.y && spec.y.length ? spec.y : inferYKeys(data, xKey)).slice(0, 3);

  if (!xKey || yKeys.length === 0) return null;

  const palette = ["#8884d8", "#82ca9d", "#ffc658"]; // simple palette

  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer>
        {spec.type === "line" ? (
          <LineChart data={data} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {yKeys.map((k, i) => (
              <Line key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} dot={false} />
            ))}
          </LineChart>
        ) : spec.type === "bar" ? (
          <BarChart data={data} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {yKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={palette[i % palette.length]} />
            ))}
          </BarChart>
        ) : spec.type === "area" ? (
          <AreaChart data={data} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {yKeys.map((k, i) => (
              <Area key={k} type="monotone" dataKey={k} stroke={palette[i % palette.length]} fill={palette[i % palette.length]} />
            ))}
          </AreaChart>
        ) : spec.type === "pie" ? (
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} outerRadius={100} fill={palette[0]}>
              {data.map((_: any, idx: number) => (
                <Cell key={`cell-${idx}`} fill={palette[idx % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : null}
      </ResponsiveContainer>
    </div>
  );
}

function inferYKeys(data: any[], xKey?: string) {
  if (!data || data.length === 0) return [] as string[];
  const keys = Object.keys(data[0]);
  return keys.filter((k) => k !== xKey && typeof (data[0] as any)[k] === "number");
}
