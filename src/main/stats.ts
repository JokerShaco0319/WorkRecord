import type { DayStat, ProjectStat, StatsReport } from '@shared/api'
import type { MonthDoc } from '@shared/md/month'

/** 单段耗时上限：超过这个间隔视为中断，不计入统计 */
export const MAX_GAP_MINUTES = 180

function minutesOf(time: string | null): number | null {
  if (!time) return null
  const [hours, minutes] = time.split(':').map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null
  return hours * 60 + minutes
}

export function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  let cursor = start.slice(0, 7)
  const last = end.slice(0, 7)

  while (cursor <= last) {
    months.push(cursor)
    const [year, month] = cursor.split('-').map(Number)
    const next = new Date(year, month, 1)
    cursor = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
  }

  return months
}

/**
 * 用相邻两条记录的时间差估算耗时：一条记录持续到写下一条记录为止。
 * 每段最多计入 MAX_GAP_MINUTES，最后一条记录不产生耗时。
 */
export function computeStats(docs: MonthDoc[], start: string, end: string): StatsReport {
  const projectTotals = new Map<string, { minutes: number; count: number }>()
  const dayTotals = new Map<string, number>()
  let entryCount = 0
  let untimedCount = 0

  for (const doc of docs) {
    for (const week of doc.weeks) {
      for (const day of week.days) {
        if (day.date < start || day.date > end) continue

        entryCount += day.entries.length
        untimedCount += day.entries.filter((entry) => entry.time === null).length

        const timed = day.entries
          .map((entry) => ({ entry, minutes: minutesOf(entry.time) }))
          .filter((item): item is { entry: (typeof day.entries)[number]; minutes: number } =>
            item.minutes !== null
          )
          .sort((a, b) => a.minutes - b.minutes)

        for (let i = 0; i < timed.length - 1; i++) {
          const gap = timed[i + 1].minutes - timed[i].minutes
          if (gap <= 0 || gap > MAX_GAP_MINUTES) continue

          const project = timed[i].entry.project ?? '其他'
          const record = projectTotals.get(project) ?? { minutes: 0, count: 0 }
          record.minutes += gap
          record.count += 1
          projectTotals.set(project, record)

          dayTotals.set(day.date, (dayTotals.get(day.date) ?? 0) + gap)
        }
      }
    }
  }

  const projects: ProjectStat[] = [...projectTotals.entries()]
    .map(([project, record]) => ({ project, minutes: record.minutes, count: record.count }))
    .sort((a, b) => b.minutes - a.minutes || a.project.localeCompare(b.project))

  const days: DayStat[] = [...dayTotals.entries()]
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    start,
    end,
    totalMinutes: projects.reduce((sum, item) => sum + item.minutes, 0),
    entryCount,
    untimedCount,
    projects,
    days
  }
}
