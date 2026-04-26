import React from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#f97316', '#eab308', '#22c55e', '#e5e7eb']

export default function ChartComponent({ totalFixed, variableExpenses, savings }) {
  const data = [
    { name: 'Fixed Expenses', value: totalFixed },
    { name: 'Variable Expenses', value: variableExpenses },
    { name: 'Savings', value: savings },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-6">No data to display yet.</p>
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-gray-700">Spending Breakdown</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
            outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
