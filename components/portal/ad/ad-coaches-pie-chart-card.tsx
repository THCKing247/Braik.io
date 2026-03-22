"use client"

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

const HEAD_COLOR = "#1D4ED8"
const ASSISTANT_COLOR = "#60A5FA"

export type CoachPieDatum = {
  name: string
  value: number
  color: string
}

function buildCoachPieData(headCoachCount: number, assistantCoachCount: number): CoachPieDatum[] {
  return [
    { name: "Head Coach", value: headCoachCount, color: HEAD_COLOR },
    { name: "Assistant Coach", value: assistantCoachCount, color: ASSISTANT_COLOR },
  ].filter((item) => item.value > 0)
}


export interface AdCoachesPieChartCardProps {
  headCoachCount: number
  assistantCoachCount: number
}

export function AdCoachesPieChartCard({ headCoachCount, assistantCoachCount }: AdCoachesPieChartCardProps) {
  const total = headCoachCount + assistantCoachCount
  const coachData = buildCoachPieData(headCoachCount, assistantCoachCount)

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-[#6B7280]">Total coaches</p>
      <p className="mt-1 text-2xl font-semibold text-[#212529]">Total coaches: {total.toLocaleString()}</p>

      {total === 0 ? (
        <div className="mt-4 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#F9FAFB] px-4 text-center text-sm text-[#6B7280]">
          No coaches assigned yet
        </div>
      ) : (
        <div className="mt-4 h-[220px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={coachData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={72}
                innerRadius={0}
                paddingAngle={coachData.length > 1 ? 2 : 0}
                label={({ name, value, percent }) =>
                  `${name}: ${value} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
              >
                {coachData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}-${index}`} fill={entry.color} stroke="#fff" strokeWidth={1} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const row = payload[0] as {
                    name?: string
                    value?: number
                    payload?: CoachPieDatum
                  }
                  const name = row?.name ?? row?.payload?.name
                  const value = row?.value ?? row?.payload?.value
                  const fill = row?.payload?.color
                  if (value === undefined || name === undefined) return null
                  return (
                    <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm shadow-md">
                      <p className="font-medium text-[#212529]">{name}</p>
                      <p className="text-[#6B7280]">
                        <span
                          className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                          style={{ backgroundColor: fill }}
                        />
                        {value.toLocaleString()} {value === 1 ? "coach" : "coaches"}
                      </p>
                    </div>
                  )
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={40}
                formatter={(value) => <span className="text-sm text-[#374151]">{value}</span>}
                iconType="circle"
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
