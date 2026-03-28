import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { MetricsHistoryEntry } from "../types";

const axisStyle = { fill: "#666", fontSize: 11 };
const gridStroke = "#2a2a4e";

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ dataKey: string; color: string; name: string; value: number }>;
  label?: string;
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#16213e", border: "1px solid #2a2a4e", borderRadius: 6, padding: "8px 12px", fontSize: "0.8em" }}>
      <div style={{ color: "#888", marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value}%
        </div>
      ))}
    </div>
  );
}

interface ChartProps {
  data: MetricsHistoryEntry[];
  dataKey: string;
  name: string;
  color: string;
}

function Chart({ data, dataKey, name, color }: ChartProps) {
  return (
    <div className="metrics-chart">
      <div className="metrics-chart-label">{name}</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
          <XAxis dataKey="time" tick={axisStyle} interval="preserveStartEnd" />
          <YAxis domain={[0, 100]} tick={axisStyle} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MetricsChartProps {
  history: MetricsHistoryEntry[];
}

export default function MetricsChart({ history }: MetricsChartProps) {
  return (
    <div className="metrics-charts">
      <Chart data={history} dataKey="cpu" name="CPU" color="#8884d8" />
      <Chart data={history} dataKey="memory" name="Memory" color="#0f9d58" />
    </div>
  );
}
