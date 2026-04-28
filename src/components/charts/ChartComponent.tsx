import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSettings } from "../../context/settingsContext";

interface ChartComponentProps {
  totalFixed: number;
  variableExpenses: number;
  savings: number;
}

export default function ChartComponent({
  totalFixed,
  variableExpenses,
  savings,
}: ChartComponentProps) {
  const { currentTheme } = useSettings();

  const data = [
    { name: "Fixed Expenses", value: totalFixed },
    { name: "Variable Expenses", value: variableExpenses },
    { name: "Savings", value: savings },
  ].filter((d) => d.value > 0);

  // Use theme-aware colors
  const colors = [
    currentTheme.colors.primary,
    currentTheme.colors.secondary,
    currentTheme.colors.success,
  ];

  if (data.length === 0) {
    return (
      <p className="text-sm text-theme-muted text-center py-6">
        No data to display yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={90}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => `$${(v as number).toFixed(2)}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
