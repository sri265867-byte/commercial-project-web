"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { type DailyDataPoint } from "@/lib/api"

const chartConfig = {
  users: {
    label: "Пользователи",
    color: "#c8ff00",
  },
  buyers: {
    label: "Покупатели",
    color: "#22d3ee",
  },
} satisfies ChartConfig

interface TagStatsChartProps {
  data: DailyDataPoint[]
  accentColor: string
  gradientUsersId: string
  gradientBuyersId: string
}

export default function TagStatsChart({
  data,
  accentColor,
  gradientUsersId,
  gradientBuyersId,
}: TagStatsChartProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/50 mb-3 px-0.5">
        Динамика за 7 дней
      </p>
      <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientUsersId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={accentColor} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={gradientBuyersId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="bg-[#1a1a1a] border-white/10"
                />
              }
            />
            <Area
              type="monotone"
              dataKey="users"
              stroke={accentColor}
              strokeWidth={2}
              fill={`url(#${gradientUsersId})`}
            />
            <Area
              type="monotone"
              dataKey="buyers"
              stroke="#22d3ee"
              strokeWidth={2}
              fill={`url(#${gradientBuyersId})`}
            />
          </AreaChart>
        </ChartContainer>

        <div className="flex items-center justify-center gap-5 mt-2">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-[10px] text-white/40">
              Пользователи
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#22d3ee]" />
            <span className="text-[10px] text-white/40">
              Покупатели
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
