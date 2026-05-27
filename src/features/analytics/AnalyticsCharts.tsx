import { useState } from 'react'
import { useSettings } from '../../context/settingsContext'
import type { AnalyticsData } from '../../types'
import ChartCard from './ChartCard'
import ViewToggle from './ViewToggle'
import YearOverYearChart from './YearOverYearChart'
import {
  CategoryBreakdownChart,
  MonthlyTotalSavingsChart,
  PayeeBreakdownChart,
  SavingsRateChart,
} from './components/BreakdownCharts'
import { MonthlyComparisonTable, MonthlyStackedChart } from './components/MonthlySpendingSection'
import { RankedCategoryTable, RankedPayeeTable } from './components/RankedTables'
import { RankedCategoryViz, RankedPayeeViz } from './components/RankedViz'
import { useThemeColors } from './hooks/useThemeColors'
import { MONTHS, getMonthCount } from './utils/analyticsChartUtils'

interface ViewProps {
  data: AnalyticsData
  colors: ReturnType<typeof useThemeColors>
  monthCount: number
  formatAmount: (n: number) => string
}

function YearView({ data, colors, monthCount, formatAmount }: ViewProps) {
  const [trendViz, setTrendViz] = useState(true)
  const [catViz, setCatViz] = useState(true)
  const [payeeViz, setPayeeViz] = useState(true)

  return (
    <div className="space-y-4">
      <ChartCard
        title="Monthly Spending"
        headerAction={<ViewToggle isViz={trendViz} onToggle={() => setTrendViz((v) => !v)} />}
      >
        {trendViz ? (
          <MonthlyStackedChart data={data} colors={colors} monthCount={monthCount} />
        ) : (
          <MonthlyComparisonTable data={data} monthCount={monthCount} />
        )}
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Category Movement"
          headerAction={<ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />}
        >
          {catViz ? (
            <RankedCategoryViz
              data={data}
              focusMonth={null}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedCategoryTable data={data} focusMonth={null} focusLabel="Year total" />
          )}
        </ChartCard>
        <ChartCard
          title="Payee Concentration"
          headerAction={<ViewToggle isViz={payeeViz} onToggle={() => setPayeeViz((v) => !v)} />}
        >
          {payeeViz ? (
            <RankedPayeeViz
              data={data}
              focusMonth={null}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedPayeeTable data={data} focusMonth={null} focusLabel="Year total" />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

interface MonthViewProps {
  data: AnalyticsData
  multiYearData: AnalyticsData[]
  colors: ReturnType<typeof useThemeColors>
  selectedMonth: number
  formatAmount: (n: number) => string
}

function MonthView({ data, multiYearData, colors, selectedMonth, formatAmount }: MonthViewProps) {
  const [catViz, setCatViz] = useState(true)
  const [payeeViz, setPayeeViz] = useState(true)

  return (
    <div className="space-y-4">
      <ChartCard title={`${MONTHS[selectedMonth]} Year over Year`}>
        <YearOverYearChart
          multiYearData={multiYearData}
          selectedMonth={selectedMonth}
          colors={colors}
          monthLabel={MONTHS[selectedMonth]}
        />
      </ChartCard>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title={`${MONTHS[selectedMonth]} Category Movement`}
          headerAction={<ViewToggle isViz={catViz} onToggle={() => setCatViz((v) => !v)} />}
        >
          {catViz ? (
            <RankedCategoryViz
              data={data}
              focusMonth={selectedMonth}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedCategoryTable
              data={data}
              focusMonth={selectedMonth}
              focusLabel={`${MONTHS[selectedMonth]} focus`}
            />
          )}
        </ChartCard>
        <ChartCard
          title={`${MONTHS[selectedMonth]} Payee Concentration`}
          headerAction={<ViewToggle isViz={payeeViz} onToggle={() => setPayeeViz((v) => !v)} />}
        >
          {payeeViz ? (
            <RankedPayeeViz
              data={data}
              focusMonth={selectedMonth}
              colors={colors}
              formatAmount={formatAmount}
            />
          ) : (
            <RankedPayeeTable
              data={data}
              focusMonth={selectedMonth}
              focusLabel={`${MONTHS[selectedMonth]} focus`}
            />
          )}
        </ChartCard>
      </div>
    </div>
  )
}

interface AnalyticsChartsProps {
  data: AnalyticsData
  multiYearData: AnalyticsData[]
  year: number
  currentYear: number
  currentMonth: number
  selectedMonth: number | null
}

export default function AnalyticsCharts({
  data,
  multiYearData,
  year,
  currentYear,
  currentMonth,
  selectedMonth,
}: AnalyticsChartsProps) {
  const colors = useThemeColors()
  const { formatAmount } = useSettings()
  const monthCount = getMonthCount(year, currentYear, currentMonth)

  return (
    <div className="space-y-4 p-4 md:p-5">
      {selectedMonth === null ? (
        <YearView data={data} colors={colors} monthCount={monthCount} formatAmount={formatAmount} />
      ) : (
        <MonthView
          data={data}
          multiYearData={multiYearData}
          colors={colors}
          selectedMonth={selectedMonth}
          formatAmount={formatAmount}
        />
      )}
    </div>
  )
}

export {
  RankedCategoryTable,
  RankedPayeeTable,
  CategoryBreakdownChart,
  PayeeBreakdownChart,
  SavingsRateChart,
  MonthlyTotalSavingsChart,
  RankedCategoryViz,
  RankedPayeeViz,
}
