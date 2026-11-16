import { useEffect, useState } from 'react'
import { formatDateKey, parseDateKey } from '@shared/date'
import { parseMonth } from '@shared/md/month'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 跨月的一周归入周一所在的月份，因此当月视图还要带上上个月的文件 */
function previousMonthKey(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

interface Props {
  value: string
  className?: string
  onSelect: (date: string) => void
}

export default function CalendarPanel({ value, className = '', onSelect }: Props) {
  const [cursor, setCursor] = useState(() => value.slice(0, 7))
  const [marked, setMarked] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    Promise.all([
      window.api.daily.readMonth(previousMonthKey(cursor)),
      window.api.daily.readMonth(cursor)
    ])
      .then(([previousFile, currentFile]) => {
        if (cancelled) return
        const dates = new Set<string>()
        for (const file of [previousFile, currentFile]) {
          const doc = parseMonth(file.month, file.raw)
          for (const week of doc.weeks) {
            for (const day of week.days) {
              if (day.date.startsWith(cursor) && day.entries.length > 0) dates.add(day.date)
            }
          }
        }
        setMarked(dates)
      })
      .catch(() => {
        if (!cancelled) setMarked(new Set())
      })

    return () => {
      cancelled = true
    }
  }, [cursor, value])

  const [year, monthNumber] = cursor.split('-').map(Number)
  const offset = (parseDateKey(`${cursor}-01`).getDay() + 6) % 7
  const daysInMonth = new Date(year, monthNumber, 0).getDate()
  const todayKey = formatDateKey(new Date())

  const cells: (string | null)[] = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${cursor}-${String(day).padStart(2, '0')}`)
  }

  function shiftMonth(delta: number): void {
    const date = new Date(year, monthNumber - 1 + delta, 1)
    setCursor(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <div
      className={`w-[268px] rounded-xl border border-line bg-surface p-3 shadow-[0_8px_24px_rgb(0_0_0_/_0.10)] ${className}`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-paper hover:text-ink"
          aria-label="上个月"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </button>
        <span className="text-[12px] font-medium">
          {year} 年 {monthNumber} 月
        </span>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="grid h-6 w-6 place-items-center rounded-md text-muted transition-colors hover:bg-paper hover:text-ink"
          aria-label="下个月"
        >
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEK_LABELS.map((label) => (
          <div key={label} className="grid h-6 place-items-center text-[11px] text-muted/70">
            {label}
          </div>
        ))}

        {cells.map((key, index) => {
          if (!key) return <div key={`blank-${index}`} />

          const isSelected = key === value
          const isToday = key === todayKey
          const hasEntries = marked.has(key)

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                'relative grid h-8 w-8 place-items-center rounded-md text-[12px] transition-colors',
                isSelected
                  ? 'bg-accent font-medium text-white'
                  : isToday
                    ? 'text-accent ring-1 ring-accent/40 hover:bg-accent-soft'
                    : 'text-ink hover:bg-paper'
              ].join(' ')}
            >
              {Number(key.slice(8))}
              {hasEntries && (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${
                    isSelected ? 'bg-white/85' : 'bg-accent/60'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
