"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, type DayPickerProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = DayPickerProps & {
  onMonthChange?: (date: Date) => void
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  onMonthChange,
  ...props
}: CalendarProps) {
  const [month, setMonth] = React.useState<Date>(props.month || new Date())

  const handleMonthChange = (newMonth: Date) => {
    setMonth(newMonth)
    onMonthChange?.(newMonth)
  }

  const currentYear = month.getFullYear()
  const currentMonth = month.getMonth()

  // 生成年份選項 (前後5年)
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i)

  // 月份選項
  const months = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月"
  ]

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value)
    const newDate = new Date(month)
    newDate.setFullYear(newYear)
    handleMonthChange(newDate)
  }

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value)
    const newDate = new Date(month)
    newDate.setMonth(newMonth)
    handleMonthChange(newDate)
  }

  const handlePrevMonth = () => {
    const newDate = new Date(month)
    newDate.setMonth(currentMonth - 1)
    handleMonthChange(newDate)
  }

  const handleNextMonth = () => {
    const newDate = new Date(month)
    newDate.setMonth(currentMonth + 1)
    handleMonthChange(newDate)
  }

  return (
    <div className="relative">
      {/* 自訂標題 */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-white/10 mb-2">
        {/* 上一個月按鈕 */}
        <button
          type="button"
          onClick={handlePrevMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-white/10 hover:bg-white/10"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* 年份和月份選擇器 */}
        <div className="flex items-center gap-2">
          <select
            value={currentYear}
            onChange={handleYearChange}
            className="text-sm font-medium text-white bg-white/5 border border-white/10 rounded px-2 py-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            {years.map((year) => (
              <option key={year} value={year} className="bg-slate-900 text-white">
                {year}年
              </option>
            ))}
          </select>

          <select
            value={currentMonth}
            onChange={handleMonthSelect}
            className="text-sm font-medium text-white bg-white/5 border border-white/10 rounded px-2 py-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer"
          >
            {months.map((monthName, index) => (
              <option key={index} value={index} className="bg-slate-900 text-white">
                {monthName}
              </option>
            ))}
          </select>
        </div>

        {/* 下一個月按鈕 */}
        <button
          type="button"
          onClick={handleNextMonth}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-8 w-8 bg-transparent p-0 opacity-70 hover:opacity-100 border-white/10 hover:bg-white/10"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* 日曆本體 */}
      <DayPicker
        month={month}
        onMonthChange={handleMonthChange}
        showOutsideDays={showOutsideDays}
        className={cn("p-0", className)}
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          month_caption: "hidden", // 隱藏預設標題,使用自訂的
          caption_label: "hidden",
          nav: "hidden", // 隱藏預設導航按鈕
          button_previous: "hidden",
          button_next: "hidden",
          month_grid: "w-full border-collapse space-y-1",
          weekdays: "flex",
          weekday: "text-white/50 rounded-md w-9 font-normal text-[0.8rem]",
          week: "flex w-full mt-2",
          day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-white/10 [&:has([aria-selected])]:bg-white/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day_button: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal text-white/90 aria-selected:opacity-100 hover:bg-white/10 hover:text-white"
          ),
          range_end: "day-range-end",
          selected:
            "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
          today: "bg-white/10 text-white",
          outside:
            "day-outside text-white/75 aria-selected:bg-white/10 aria-selected:text-white/90",
          disabled: "text-white/30 opacity-50",
          range_middle: "aria-selected:bg-white/10 aria-selected:text-white",
          hidden: "invisible",
          ...classNames,
        }}
        {...props}
      />
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
