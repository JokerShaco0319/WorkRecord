import { addDaysKey, formatMonthDay, parseDateKey, weekStartKey } from '../date'
import type { MonthDoc } from './month'
import type { TodoItem } from './todo'

export interface WeekEntry {
  date: string
  time: string | null
  project: string | null
  content: string
  tags: string[]
}

export interface WeekRange {
  key: string
  start: string
  end: string
  year: number
  weekNumber: number
  title: string
}

export const AUTO_START = '<!-- auto:start -->'
export const AUTO_END = '<!-- auto:end -->'

function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000)
}

/** ISO 8601 周编号：周四所在的年份决定年份 */
export function isoWeekKey(dateKey: string): string {
  const thursday = addDaysKey(weekStartKey(dateKey), 3)
  const year = Number(thursday.slice(0, 4))
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1
  return `${year}-W${String(week).padStart(2, '0')}`
}

export function weekRangeFromKey(key: string): WeekRange {
  const [yearPart, weekPart] = key.split('-W')
  const year = Number(yearPart)
  const weekNumber = Number(weekPart)
  const firstMonday = weekStartKey(`${year}-01-04`)
  const start = addDaysKey(firstMonday, (weekNumber - 1) * 7)

  return {
    key,
    start,
    end: addDaysKey(start, 6),
    year,
    weekNumber,
    title: `${year} 年第 ${weekNumber} 周`
  }
}

export function weekRangeOfDate(dateKey: string): WeekRange {
  return weekRangeFromKey(isoWeekKey(dateKey))
}

export function collectWeekEntries(doc: MonthDoc, start: string, end: string): WeekEntry[] {
  const entries: WeekEntry[] = []

  for (const week of doc.weeks) {
    for (const day of week.days) {
      if (day.date < start || day.date > end) continue
      for (const entry of day.entries) {
        entries.push({
          date: day.date,
          time: entry.time,
          project: entry.project,
          content: entry.content,
          tags: entry.tags
        })
      }
    }
  }

  entries.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')
  )
  return entries
}

function groupByProject(entries: WeekEntry[]): Array<[string, WeekEntry[]]> {
  const groups = new Map<string, WeekEntry[]>()
  for (const entry of entries) {
    const key = entry.project ?? '其他'
    const list = groups.get(key)
    if (list) list.push(entry)
    else groups.set(key, [entry])
  }

  return [...groups.entries()].sort((a, b) => {
    if (a[0] === '其他') return 1
    if (b[0] === '其他') return -1
    return b[1].length - a[1].length || a[0].localeCompare(b[0])
  })
}

/** 生成周报正文（不含前后置标记），供预览与写入共用 */
export function buildWeeklyBody(
  entries: WeekEntry[],
  todos: TodoItem[],
  weekEnd: string
): string {
  const sections: string[] = []

  for (const [project, list] of groupByProject(entries)) {
    const seen = new Set<string>()
    const lines: string[] = []
    for (const entry of list) {
      const dedupeKey = `${entry.date}|${entry.content}`
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)
      lines.push(`- ${formatMonthDay(entry.date)} ${entry.content}`)
    }
    if (lines.length > 0) sections.push(`## ${project}\n\n${lines.join('\n')}`)
  }

  const cutoff = addDaysKey(weekEnd, 7)
  const plans = todos
    .filter((item) => !item.done && item.due && item.due <= cutoff)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''))
    .map((item) => `- [ ] ${item.content}（截止 ${formatMonthDay(item.due as string)}）`)

  if (plans.length > 0) sections.push(`## 下周计划\n\n${plans.join('\n')}`)

  if (sections.length === 0) return '_本周还没有记录。_'
  return sections.join('\n\n')
}

export function buildWeeklyFile(range: WeekRange, body: string): string {
  const rangeLabel = `${formatMonthDay(range.start)} ~ ${formatMonthDay(range.end)}`
  return [
    '---',
    `week: ${range.key}`,
    `range: ${range.start} ~ ${range.end}`,
    '---',
    '',
    `# ${range.title}（${rangeLabel}）`,
    '',
    AUTO_START,
    body.trim(),
    AUTO_END,
    ''
  ].join('\n')
}

/** 只替换自动区块，保留用户手写的内容；没有标记时追加到文件末尾 */
export function mergeAutoBlock(raw: string, body: string): string {
  const startIndex = raw.indexOf(AUTO_START)
  const endIndex = raw.indexOf(AUTO_END)

  if (startIndex >= 0 && endIndex > startIndex) {
    return (
      raw.slice(0, startIndex + AUTO_START.length) +
      '\n' +
      body.trim() +
      '\n' +
      raw.slice(endIndex)
    )
  }

  const trimmed = raw.replace(/\s+$/, '')
  const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : ''
  return `${prefix}${AUTO_START}\n${body.trim()}\n${AUTO_END}\n`
}
