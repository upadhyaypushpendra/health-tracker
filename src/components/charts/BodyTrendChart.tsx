import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface DataPoint {
  date: string
  weight: number | null
  bmi?: number | null
  bodyFat?: number | null
}

interface BodyTrendChartProps {
  data: DataPoint[]
  goalWeight: number | null
}

export function BodyTrendChart({ data, goalWeight }: BodyTrendChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), 'MMM d'),
  }))

  const weights = data.map(d => d.weight).filter((w): w is number => w !== null)
  const allValues = goalWeight !== null ? [...weights, goalWeight] : weights
  const min = allValues.length ? Math.min(...allValues) : 0
  const max = allValues.length ? Math.max(...allValues) : 100
  const pad = Math.max(1, (max - min) * 0.1)
  const yDomain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)]

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="dateLabel"
          tick={{ fill: '#555555', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#555555', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          domain={yDomain}
        />
        <Tooltip
          contentStyle={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, color: '#fff', fontSize: 12 }}
          formatter={(v: number) => [`${v} kg`, 'Weight']}
        />
        {goalWeight && (
          <ReferenceLine
            y={goalWeight}
            stroke="#00FF87"
            strokeDasharray="4 4"
            label={{ value: `Goal ${goalWeight}kg`, fill: '#00FF87', fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#FF6B35"
          strokeWidth={2}
          dot={{ fill: '#FF6B35', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#FF6B35' }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
