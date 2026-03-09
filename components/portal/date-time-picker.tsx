"use client"

import * as React from "react"
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  startOfDay,
  addDays,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  getHours,
  getMinutes,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1) // 1-12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5) // 0, 5, 10, ..., 55

function to12Hour(hour24: number): { hour: number; ampm: "AM" | "PM" } {
  if (hour24 === 0) return { hour: 12, ampm: "AM" }
  if (hour24 < 12) return { hour: hour24, ampm: "AM" }
  if (hour24 === 12) return { hour: 12, ampm: "PM" }
  return { hour: hour24 - 12, ampm: "PM" }
}

function to24Hour(hour12: number, ampm: "AM" | "PM"): number {
  if (ampm === "AM") return hour12 === 12 ? 0 : hour12
  return hour12 === 12 ? 12 : hour12 + 12
}

export interface DateTimePickerProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  /** If set, min date for calendar (e.g. start date when picking end) */
  minDate?: Date | null
  /** Default time when picking a new date and none set (e.g. from start date) */
  defaultTime?: Date | null
  className?: string
  id?: string
}

export function DateTimePicker({
  label,
  value,
  onChange,
  placeholder = "Select date and time",
  minDate,
  defaultTime,
  className,
  id,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draftDate, setDraftDate] = React.useState<Date>(() => value ?? defaultTime ?? new Date())
  const [draftHour, setDraftHour] = React.useState(() => {
    const d = value ?? defaultTime ?? new Date()
    return to12Hour(getHours(d)).hour
  })
  const [draftMinute, setDraftMinute] = React.useState(() => {
    const d = value ?? defaultTime ?? new Date()
    return Math.floor(getMinutes(d) / 5) * 5
  })
  const [draftAmPm, setDraftAmPm] = React.useState<"AM" | "PM">(() => {
    const d = value ?? defaultTime ?? new Date()
    return to12Hour(getHours(d)).ampm
  })
  const [month, setMonth] = React.useState<Date>(() => value ?? defaultTime ?? new Date())

  const openPopover = React.useCallback(() => {
    const base = value ?? defaultTime ?? new Date()
    setDraftDate(base)
    setMonth(base)
    setDraftHour(to12Hour(getHours(base)).hour)
    setDraftMinute(Math.floor(getMinutes(base) / 5) * 5)
    setDraftAmPm(to12Hour(getHours(base)).ampm)
    setOpen(true)
  }, [value, defaultTime])

  const apply = React.useCallback(() => {
    const d = new Date(draftDate)
    const h = to24Hour(draftHour, draftAmPm)
    const m = draftMinute
    d.setHours(h, m, 0, 0)
    onChange(d)
    setOpen(false)
  }, [draftDate, draftHour, draftMinute, draftAmPm, onChange])

  const cancel = React.useCallback(() => {
    setOpen(false)
  }, [])

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel()
    },
    [cancel]
  )

  const displayValue = value ? format(value, "MMM d, yyyy, h:mm a") : ""

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay())
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const minDay = minDate ? startOfDay(minDate) : null

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[#0F172A]">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            onClick={openPopover}
            className={cn(
              "flex h-11 w-full items-center rounded-xl border-2 bg-white px-4 py-2.5 text-left text-sm",
              "ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2",
              "transition-all duration-200 text-[#0F172A]",
              !displayValue && "text-[#6B7280]"
            )}
            style={{ borderColor: "rgb(var(--border))" }}
          >
            {displayValue || placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-auto max-w-[95vw] p-0 overflow-hidden"
          onKeyDown={handleKeyDown}
          style={{
            borderColor: "rgb(var(--border))",
            boxShadow: "0 8px 30px rgba(11, 42, 91, 0.15)",
            zIndex: 100,
          }}
        >
          <div className="flex flex-col sm:flex-row">
            {/* Calendar */}
            <div className="p-3 border-b sm:border-b-0 sm:border-r" style={{ borderColor: "rgb(var(--border))" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setMonth(subMonths(month, 1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: "rgb(var(--text))" }}>
                  {format(month, "MMMM yyyy")}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-medium mb-1" style={{ color: "rgb(var(--muted))" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {days.map((day) => {
                  const sameMonth = isSameMonth(day, month)
                  const selected = isSameDay(day, draftDate)
                  const today = isToday(day)
                  const disabled = minDay ? day < minDay : false
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && setDraftDate(day)}
                      className={cn(
                        "h-8 w-8 rounded-lg text-sm transition-colors",
                        sameMonth ? "text-[#0F172A]" : "text-[#9CA3AF]",
                        selected && "bg-[#3B82F6] text-white hover:bg-[#2563EB]",
                        !selected && !disabled && "hover:bg-[#F3F4F6]",
                        today && !selected && "ring-2 ring-[#3B82F6] ring-offset-1",
                        disabled && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Time */}
            <div className="p-3 flex flex-col gap-2 min-w-[140px]">
              <div className="text-xs font-medium" style={{ color: "rgb(var(--muted))" }}>
                Time
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draftHour}
                  onChange={(e) => setDraftHour(Number(e.target.value))}
                  className={cn(
                    "h-9 rounded-lg border-2 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1"
                  )}
                  style={{ borderColor: "rgb(var(--border))" }}
                  aria-label="Hour"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-[#0F172A] font-medium">:</span>
                <select
                  value={draftMinute}
                  onChange={(e) => setDraftMinute(Number(e.target.value))}
                  className={cn(
                    "h-9 rounded-lg border-2 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1"
                  )}
                  style={{ borderColor: "rgb(var(--border))" }}
                  aria-label="Minute"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, "0")}
                    </option>
                  ))}
                </select>
                <select
                  value={draftAmPm}
                  onChange={(e) => setDraftAmPm(e.target.value as "AM" | "PM")}
                  className={cn(
                    "h-9 rounded-lg border-2 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-offset-1"
                  )}
                  style={{ borderColor: "rgb(var(--border))" }}
                  aria-label="AM/PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 p-3 border-t" style={{ borderColor: "rgb(var(--border))" }}>
            <Button type="button" variant="outline" size="sm" onClick={cancel} className="rounded-xl">
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={apply} className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white shadow">
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
