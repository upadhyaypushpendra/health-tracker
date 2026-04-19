import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

interface DataPoint {
  date: string
  actual: number
  target: number
}

interface PlanVsActualChartProps {
  data: DataPoint[]
  unit?: string
  referenceLine?: number
}

/** Single SVG group: gray background (= target) + colored overlay (= actual) */
const OverlayBar = (props: any) => {
  const { x, y, width, height, payload } = props
  if (!width || height == null || height < 0) return null

  const { actual = 0, target = 0 } = payload
  if (target <= 0) return <rect x={x} y={y} width={width} height={Math.max(height, 2)} fill="#2A2A2A" rx={3} ry={3} />

  const fillPct = Math.min(actual / target, 1)
  const actualH = Math.round(fillPct * height)
  const isOver = actual > target

  return (
    <g>
      {/* Background = target */}
      <rect x={x} y={y} width={width} height={height} fill="#2A2A2A" rx={3} ry={3} />
      {/* Foreground = actual — grows from the bottom */}
      {actual > 0 && (
        <rect
          x={x}
          y={y + height - Math.max(actualH, 3)}
          width={width}
          height={Math.max(actualH, 3)}
          fill={isOver ? '#FF6B35' : '#00FF87'}
          fillOpacity={0.9}
          rx={3}
          ry={3}
        />
      )}
    </g>
  )
}

const CustomTooltip = ({ active, payload, label, unit }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as DataPoint
  const isOver = d.actual > d.target
  return (
    <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8, padding: '8px 12px', fontSize: 11 }}>
      <p style={{ color: '#999', marginBottom: 4 }}>{label}</p>
      <p style={{ color: isOver ? '#FF6B35' : '#00FF87' }}>Actual: {d.actual} {unit}</p>
      <p style={{ color: '#555' }}>Target: {d.target} {unit}</p>
    </div>
  )
}

export function PlanVsActualChart({ data, unit = '', referenceLine }: PlanVsActualChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: '#555555', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fill: '#555555', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip unit={unit} />} cursor={false} />
        {/* Single bar — custom shape handles both background and overlay */}
        <Bar dataKey="target" maxBarSize={28} shape={<OverlayBar />} isAnimationActive={false} />
        {referenceLine !== undefined && (
          <ReferenceLine
            y={referenceLine}
            stroke="#00FF87"
            strokeDasharray="4 4"
            label={{ value: `${referenceLine} ${unit}`, fill: '#00FF87', fontSize: 10, position: 'insideTopRight' }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}
