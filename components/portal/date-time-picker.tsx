"use client"

/**
 * Unified date/time UI (mini calendar + clock selects). Use everywhere users pick dates or times:
 * - DatePicker — date only
 * - DateTimePicker — date + time (events, practices)
 */
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

/** For APIs that expect YYYY-MM-DD */
export function dateToYmd(d: Date | null): string {
  if (!d) return ""
  return format(startOfDay(d), "yyyy-MM-dd")
}

export function ymdToDate(s: string): Date | null {
  if (!s?.trim()) return null
  const [y, m, day] = s.split("-").map(Number)
  if (!y || !m || !day) return null
  return startOfDay(new Date(y, m - 1, day))
}

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

/** Shared mini calendar (matches schedule / event flows) */
function MiniCalendarGrid({
  month,
  setMonth,
  draftDate,
  onSelectDay,
  minDate,
  maxDate,
  layout = "withTime",
  monthYearNav = false,
}: {
  month: Date
  setMonth: (d: Date) => void
  draftDate: Date
  onSelectDay: (d: Date) => void
  minDate?: Date | null
  maxDate?: Date | null
  layout?: "withTime" | "solo"
  /** Month + year dropdowns (e.g. date of birth) — avoids month-by-month clicking. */
  monthYearNav?: boolean
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = addDays(monthEnd, 6 - monthEnd.getDay())
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  const minDay = minDate ? startOfDay(minDate) : null
  const maxDay = maxDate ? startOfDay(maxDate) : null

  const yearOptions = React.useMemo(() => {
    const hi = maxDate ? maxDate.getFullYear() : new Date().getFullYear()
    const lo = minDate ? minDate.getFullYear() : hi - 120
    const arr: number[] = []
    for (let y = hi; y >= lo; y--) arr.push(y)
    return arr
  }, [minDate, maxDate])

  return (
    <div
      className={cn(
        "p-3 flex flex-col min-h-0",
        layout === "withTime" && "border-b sm:border-b-0 sm:border-r border-border"
      )}
    >
      {monthYearNav ? (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2 shrink-0">
          <label className="sr-only" htmlFor="mini-cal-month">
            Month
          </label>
          <select
            id="mini-cal-month"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground max-w-[11rem]"
            value={month.getMonth()}
            onChange={(e) => {
              const m = Number(e.target.value)
              setMonth(startOfMonth(new Date(month.getFullYear(), m, 1)))
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>
                {format(new Date(2000, i, 1), "MMMM")}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="mini-cal-year">
            Year
          </label>
          <select
            id="mini-cal-year"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm text-foreground w-[5.5rem]"
            value={month.getFullYear()}
            onChange={(e) => {
              const y = Number(e.target.value)
              setMonth(startOfMonth(new Date(y, month.getMonth(), 1)))
            }}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={() => setMonth(subMonths(month, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[120px] text-center text-foreground">
            {format(month, "MMMM yyyy")}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={() => setMonth(addMonths(month, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      <div className="grid grid-cols-7 gap-0.5 text-center text-xs font-medium mb-1 text-muted-foreground shrink-0">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 min-h-0">
        {days.map((day) => {
          const sameMonth = isSameMonth(day, month)
          const selected = isSameDay(day, draftDate)
          const today = isToday(day)
          const d0 = startOfDay(day)
          const disabled =
            (minDay !== null && d0 < minDay) || (maxDay !== null && d0 > maxDay)
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelectDay(day)}
              className={cn(
                "h-8 w-8 rounded-lg text-sm transition-colors",
                sameMonth ? "text-foreground" : "text-muted-foreground",
                selected && "bg-primary text-primary-foreground hover:bg-primary/90",
                !selected && !disabled && "hover:bg-muted/50",
                today && !selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
                disabled && "opacity-40 cursor-not-allowed"
              )}
            >
              {format(day, "d")}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface DatePickerProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  minDate?: Date | null
  maxDate?: Date | null
  className?: string
  id?: string
  /** Show Clear to set null (optional dates) */
  allowClear?: boolean
  /** Month/year dropdowns for fast navigation (date of birth, etc.). */
  birthdateNav?: boolean
}

/** Date only — same mini calendar as DateTimePicker */
export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date",
  minDate,
  maxDate,
  className,
  id,
  allowClear,
  birthdateNav,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draftDate, setDraftDate] = React.useState<Date>(() => value ?? new Date())
  const [month, setMonth] = React.useState<Date>(() => value ?? new Date())

  const openPopover = React.useCallback(() => {
    const base = value ?? new Date()
    setDraftDate(startOfDay(base))
    setMonth(base)
    setOpen(true)
  }, [value])

  const apply = React.useCallback(() => {
    onChange(startOfDay(draftDate))
    setOpen(false)
  }, [draftDate, onChange])

  const cancel = React.useCallback(() => setOpen(false), [])
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel()
    },
    [cancel]
  )

  const displayValue = value ? format(value, "MMM d, yyyy") : ""

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
              "flex h-11 w-full items-center rounded-xl border-2 border-border bg-background px-4 py-2.5 text-left text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "transition-all duration-200 text-foreground",
              !displayValue && "text-muted-foreground"
            )}
          >
            {displayValue || placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions
          collisionPadding={12}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            "w-auto max-w-[min(95vw,320px)] p-0 overflow-hidden border border-border bg-card shadow-lg z-[100]",
            birthdateNav && "max-h-[min(85vh,400px)]"
          )}
          onKeyDown={handleKeyDown}
        >
          <MiniCalendarGrid
            month={month}
            setMonth={setMonth}
            draftDate={draftDate}
            onSelectDay={(d) => setDraftDate(startOfDay(d))}
            minDate={minDate}
            maxDate={maxDate}
            layout="solo"
            monthYearNav={birthdateNav}
          />
          <div className="flex flex-wrap justify-end gap-2 p-3 border-t border-border">
            {allowClear && value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className="rounded-xl mr-auto"
              >
                Clear
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={cancel} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={apply}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow"
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export interface DateTimePickerProps {
  label: string
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  minDate?: Date | null
  maxDate?: Date | null
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
  maxDate,
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

  const cancel = React.useCallback(() => setOpen(false), [])
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") cancel()
    },
    [cancel]
  )

  const displayValue = value ? format(value, "MMM d, yyyy, h:mm a") : ""

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
              "flex h-11 w-full items-center rounded-xl border-2 border-border bg-background px-4 py-2.5 text-left text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "transition-all duration-200 text-foreground",
              !displayValue && "text-muted-foreground"
            )}
          >
            {displayValue || placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-auto max-w-[95vw] p-0 overflow-hidden border border-border bg-card shadow-lg z-[100]"
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col sm:flex-row">
            <MiniCalendarGrid
              month={month}
              setMonth={setMonth}
              draftDate={draftDate}
              onSelectDay={setDraftDate}
              minDate={minDate}
              maxDate={maxDate}
            />
            <div className="p-3 flex flex-col gap-2 min-w-[140px]">
              <div className="text-xs font-medium text-muted-foreground">Time</div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draftHour}
                  onChange={(e) => setDraftHour(Number(e.target.value))}
                  className="h-9 rounded-lg border-2 border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  aria-label="Hour"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <span className="text-foreground font-medium">:</span>
                <select
                  value={draftMinute}
                  onChange={(e) => setDraftMinute(Number(e.target.value))}
                  className="h-9 rounded-lg border-2 border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
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
                  className="h-9 rounded-lg border-2 border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  aria-label="AM/PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 p-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={cancel} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={apply}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow"
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
