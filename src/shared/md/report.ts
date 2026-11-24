import { formatMonthDay } from '../date'
import type { DailyEntry, MonthDoc } from './month'

export interface MonthReportEntry {
  date: string
  project: string | null
  content: string
}

/** 日报导出：去掉时间标记，按内容顺序编号 */
export function buildDailyReport(date: string, entries: DailyEntry[]): string {
  const items = [...entries]
    .sort((a, b) => (a.time ?? '99:99').localeCompare(b.time ?? '99:99'))
    .map(formatEntry)
    .filter((line) => line.length > 0)

  const lines = items.map((line, index) => `${index + 1}. ${line}`)
  return [`# ${date} 工作清单`, '', ...lines].join('\n').trimEnd()
}

function formatEntry(entry: DailyEntry): string {
  const parts: string[] = []
  if (entry.project) parts.push(`[[${entry.project}]]`)
  if (entry.content) parts.push(entry.content)
  for (const tag of entry.tags) parts.push(`#${tag}`)
  return parts.join(' ')
}

/** 汇总某个月份的记录；跨月的一周可能存在上个月的文件里，所以传入多个月份文档 */
export function collectMonthEntries(docs: MonthDoc[], month: string): MonthReportEntry[] {
  const entries: MonthReportEntry[] = []

  for (const doc of docs) {
    for (const week of doc.weeks) {
      for (const day of week.days) {
        if (!day.date.startsWith(month)) continue
        for (const entry of day.entries) {
          const content = entry.content.trim()
          if (!content) continue
          entries.push({ date: day.date, project: entry.project, content })
        }
      }
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date))
}

function groupByProject(entries: MonthReportEntry[]): Array<[string, MonthReportEntry[]]> {
  const groups = new Map<string, MonthReportEntry[]>()
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

/** 月报导出：按项目分类，每条记录带日期 */
export function buildMonthlyReport(month: string, entries: MonthReportEntry[]): string {
  const [year, monthNumber] = month.split('-')
  const title = `# ${year} 年 ${Number(monthNumber)} 月 月报`
  const sections: string[] = []

  for (const [project, list] of groupByProject(entries)) {
    const seen = new Set<string>()
    const lines: string[] = []
    for (const entry of list) {
      const key = `${entry.date}|${entry.content}`
      if (seen.has(key)) continue
      seen.add(key)
      lines.push(`- ${formatMonthDay(entry.date)} ${entry.content}`)
    }
    if (lines.length > 0) sections.push(`## ${project}\n\n${lines.join('\n')}`)
  }

  if (sections.length === 0) return `${title}\n\n本月还没有记录。`
  return `${title}\n\n${sections.join('\n\n')}`
}
