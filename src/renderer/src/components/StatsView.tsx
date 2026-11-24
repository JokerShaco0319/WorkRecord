import { useEffect, useState } from 'react'
import type { DayStat, StatsReport } from '@shared/api'
import {
  addDaysKey,
  formatDateKey,
  parseDateKey,
  weekEndKey,
  weekStartKey
} from '@shared/date'

type Preset = 'week' | 'month' | '30d'

const PRESETS: Array<{ key: Preset; label: string }> = [
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: '30d', label: '近 30 天' }
]

function rangeFor(preset: Preset, today: string): { start: string; end: string } {
  if (preset === 'week') {
    return { start: weekStartKey(today), end: weekEndKey(today) }
  }
  if (preset === 'month') {
    const monthPrefix = today.slice(0, 7)
    const [year, month] = today.split('-').map(Number)
    const lastDay = new Date(year, month, 0).getDate()
    return { start: `${monthPrefix}-01`, end: `${monthPrefix}-${String(lastDay).padStart(2, '0')}` }
  }
  return { start: addDaysKey(today, -29), end: today }
}

function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0 分钟'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} 分钟`
  if (rest === 0) return `${hours} 小时`
  return `${hours} 小时 ${rest} 分`
}

function formatDayLabel(key: string): string {
  const date = parseDateKey(key)
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

/** 按日期铺满整个范围，缺失的日期补 0，避免图表把间隔压缩掉 */
function fillDays(days: DayStat[], start: string, end: string): DayStat[] {
  const map = new Map(days.map((day) => [day.date, day.minutes]))
  const result: DayStat[] = []

  let cursor = start
  while (cursor <= end) {
    result.push({ date: cursor, minutes: map.get(cursor) ?? 0 })
    cursor = addDaysKey(cursor, 1)
  }

  return result
}

export default function StatsView() {
  const today = formatDateKey(new Date())
  const [preset, setPreset] = useState<Preset>('week')
  const [report, setReport] = useState<StatsReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { start, end } = rangeFor(preset, today)

  useEffect(() => {
    let cancelled = false

    window.api.stats
      .range(start, end)
      .then((next) => {
        if (!cancelled) {
          setReport(next)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [start, end])

  const projects = report?.projects ?? []
  const days = report ? fillDays(report.days, start, end) : []
  const maxProject = projects.reduce((max, item) => Math.max(max, item.minutes), 0)
  const maxDay = days.reduce((max, item) => Math.max(max, item.minutes), 0)
  const total = report?.totalMinutes ?? 0

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-8 lg:px-10 lg:pb-6 lg:pt-10">
        <div className="mx-auto w-full max-w-[980px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Stats
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">统计</h1>
                <span className="text-sm text-muted">
                  {formatDayLabel(start)} ~ {formatDayLabel(end)}
                </span>
              </div>
            </div>

            <div className="flex self-start rounded-lg border border-line bg-paper p-0.5">
              {PRESETS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  data-action={`stats-${item.key}`}
                  onClick={() => setPreset(item.key)}
                  className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                    preset === item.key
                      ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-14">
        <div className="mx-auto w-full max-w-[980px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="rounded-xl border border-line bg-surface px-4 py-4">
              <div className="text-[11px] text-muted">总耗时</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">
                {formatDuration(total)}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-4">
              <div className="text-[11px] text-muted">记录条数</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">
                {report?.entryCount ?? 0}
              </div>
            </div>
            <div className="rounded-xl border border-line bg-surface px-4 py-4">
              <div className="text-[11px] text-muted">涉及项目</div>
              <div className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums">
                {projects.length}
              </div>
            </div>
          </div>

          <section className="mt-4 rounded-xl border border-line bg-surface p-5">
            <h2 className="text-[13px] font-medium">按项目</h2>

            {projects.length > 0 ? (
              <div className="mt-4 space-y-3">
                {projects.map((item) => {
                  const share = total > 0 ? Math.round((item.minutes / total) * 100) : 0
                  return (
                    <div key={item.project}>
                      <div className="flex items-baseline justify-between gap-3 text-[12px]">
                        <span className="truncate">{item.project}</span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {formatDuration(item.minutes)}
                          <span className="ml-2 text-muted/60">{share}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-paper">
                        <div
                          className="h-2 rounded-full bg-[var(--color-chart-bar)]"
                          style={{
                            width: `${maxProject > 0 ? (item.minutes / maxProject) * 100 : 0}%`
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="mt-4 text-[12px] text-muted">
                {report && report.entryCount > 0
                  ? '这段时间的记录缺少连续时间戳，无法估算耗时。'
                  : '这段时间还没有记录。'}
              </p>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-medium">按天</h2>
              {maxDay > 0 && (
                <span className="text-[10px] text-muted/60">
                  单日最高 {formatDuration(maxDay)}
                </span>
              )}
            </div>

            {days.length > 0 && maxDay > 0 ? (
              <>
                <div className="mt-4 flex h-28 items-end gap-[2px]">
                  {days.map((item) => {
                    const empty = item.minutes === 0
                    const height = empty
                      ? '2px'
                      : `${Math.max((item.minutes / maxDay) * 100, 2)}%`

                    return (
                      <div
                        key={item.date}
                        title={`${formatDayLabel(item.date)} · ${formatDuration(item.minutes)}`}
                        className={`flex-1 rounded-t-[4px] ${
                          empty ? 'bg-line' : 'bg-[var(--color-chart-bar)]'
                        }`}
                        style={{ height }}
                      />
                    )
                  })}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-muted/60">
                  <span>{formatDayLabel(days[0].date)}</span>
                  <span>{formatDayLabel(days[days.length - 1].date)}</span>
                </div>
              </>
            ) : (
              <p className="mt-4 text-[12px] text-muted">还没有可绘制的数据。</p>
            )}
          </section>

          <section className="mt-4 rounded-xl border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-medium">已完成待办</h2>
              <span className="text-[10px] text-muted/60">
                {report?.completed.length ?? 0} 项
              </span>
            </div>

            {report && report.completed.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {report.completed.map((item) => (
                  <li
                    key={`${item.doneDate}-${item.content}`}
                    className="flex items-baseline gap-2 text-[12px]"
                  >
                    <span className="w-10 shrink-0 font-mono text-[11px] tabular-nums text-muted/70">
                      {item.doneDate.slice(5)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted line-through decoration-muted/40">
                      {item.content}
                    </span>
                    {item.project && (
                      <span className="shrink-0 rounded bg-accent-soft px-1.5 py-px text-[10px] text-accent">
                        {item.project}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] text-muted">这段时间没有完成的事项。</p>
            )}
          </section>

          {report && report.untimedCount > 0 && (
            <p className="mt-3 px-1 text-[11px] text-muted/70">
              有 {report.untimedCount} 条记录没有时间戳，未计入耗时。
            </p>
          )}

          <p className="mt-1 px-1 text-[11px] text-muted/60">
            耗时按相邻两条记录的时间差估算，单段超过 3 小时不计入。
          </p>
        </div>
      </div>
    </div>
  )
}
