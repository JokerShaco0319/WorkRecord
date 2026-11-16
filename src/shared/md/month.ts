import {
  addDaysKey,
  formatMonthDay,
  parseDateKey,
  weekdayCn,
  weekEndKey,
  weekStartKey
} from '../date'
import { FENCE_RE, frontmatterEnd, insertBlock, sectionEnd } from './section'

export interface DailyEntry {
  /** 'HH:mm'，未写时间时为 null */
  time: string | null
  /** [[项目名]]，未关联项目时为 null */
  project: string | null
  content: string
  tags: string[]
  done: boolean
  /** 在原始文本中的行号（0 起） */
  line: number
  /** 原始行内容 */
  raw: string
}

export interface DaySection {
  date: string
  line: number
  entries: DailyEntry[]
}

export interface WeekSection {
  /** 所在周的周一 */
  start: string
  end: string
  line: number
  days: DaySection[]
}

export interface MonthDoc {
  /** 'YYYY-MM' */
  month: string
  raw: string
  weeks: WeekSection[]
}

export interface DayDoc {
  date: string
  month: string
  monthRaw: string
  entries: DailyEntry[]
}

export interface EntryInput {
  time?: string | null
  project?: string | null
  content: string
  tags?: string[]
  done?: boolean
}

/** 指向文件中的某一条目：行号 + 原始行内容，用于校验文件是否被外部改动 */
export interface EntryTarget {
  line: number
  raw: string
}

interface Range {
  start: number
  end: number
}

const BULLET_RE = /^\s*-\s+(.*)$/
const CHECKBOX_RE = /^\[([ xX])\]\s*/
const TIME_RE = /^(\d{1,2}:\d{2})\s+/
const WIKI_RE = /^\[\[([^\]]+)\]\]\s*/
const TAG_RE = /(?:^|\s)#([^\s#]+)/g
const WEEK_RE = /^##\s+(\d{2})-(\d{2})\s*~\s*(\d{2})-(\d{2})\s*$/
const DAY_RE = /^###\s+(\d{2})-(\d{2})(?:\s+.*)?$/

export function monthTemplate(month: string): string {
  return `---\nmonth: ${month}\n---\n\n# ${month.slice(0, 4)} 年 ${Number(month.slice(5))} 月\n`
}

export function parseEntryLine(line: string, index: number): DailyEntry | null {
  const bullet = BULLET_RE.exec(line)
  if (!bullet) return null

  let rest = bullet[1]
  let done = false

  const check = CHECKBOX_RE.exec(rest)
  if (check) {
    done = check[1].toLowerCase() === 'x'
    rest = rest.slice(check[0].length)
  }

  let time: string | null = null
  const tm = TIME_RE.exec(rest)
  if (tm) {
    time = tm[1].padStart(5, '0')
    rest = rest.slice(tm[0].length)
  }

  let project: string | null = null
  const wiki = WIKI_RE.exec(rest)
  if (wiki) {
    project = wiki[1].trim()
    rest = rest.slice(wiki[0].length)
  }

  const tags: string[] = []
  rest = rest.replace(TAG_RE, (_match, tag: string) => {
    tags.push(tag)
    return ''
  })

  const content = rest.trim()
  if (!content && !project) return null

  return { time, project, content, tags, done, line: index, raw: line }
}

/** 在某一周的 7 天里找出 'MM-DD' 对应的完整日期 */
function resolveDayDate(weekStart: string, monthDay: string): string | null {
  for (let offset = 0; offset < 7; offset++) {
    const candidate = addDaysKey(weekStart, offset)
    if (candidate.slice(5) === monthDay) return candidate
  }
  return null
}

function parseDays(lines: string[], weekStart: string, from: number, to: number): DaySection[] {
  const days: DaySection[] = []
  let inFence = false

  for (let i = from; i < to; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const m = DAY_RE.exec(line)
    if (!m) continue

    const date = resolveDayDate(weekStart, `${m[1]}-${m[2]}`)
    if (!date) continue

    const end = sectionEnd(lines, i, 3)
    const entries: DailyEntry[] = []
    let fence = false
    for (let j = i + 1; j < end; j++) {
      if (FENCE_RE.test(lines[j])) {
        fence = !fence
        continue
      }
      if (fence) continue
      const entry = parseEntryLine(lines[j], j)
      if (entry) entries.push(entry)
    }

    days.push({ date, line: i, entries })
    i = end - 1
  }

  return days
}

export function parseMonth(month: string, raw: string): MonthDoc {
  const lines = raw.split('\n')
  const year = month.slice(0, 4)
  const bodyStart = frontmatterEnd(lines)
  const weeks: WeekSection[] = []
  let inFence = false

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const m = WEEK_RE.exec(line)
    if (!m) continue

    const start = `${year}-${m[1]}-${m[2]}`
    const end = sectionEnd(lines, i, 2)
    weeks.push({
      start,
      end: addDaysKey(start, 6),
      line: i,
      days: parseDays(lines, start, i + 1, end)
    })
  }

  return { month, raw, weeks }
}

export function dayDoc(doc: MonthDoc, date: string): DayDoc {
  for (const week of doc.weeks) {
    const day = week.days.find((item) => item.date === date)
    if (day) return { date, month: doc.month, monthRaw: doc.raw, entries: day.entries }
  }
  return { date, month: doc.month, monthRaw: doc.raw, entries: [] }
}

export function serializeEntry(input: EntryInput): string {
  const segments = ['-']
  if (input.done) segments.push('[x]')
  if (input.time) segments.push(input.time)
  if (input.project) segments.push(`[[${input.project}]]`)

  const content = input.content.trim()
  if (content) segments.push(content)
  for (const tag of input.tags ?? []) segments.push(`#${tag}`)

  return segments.join(' ')
}

function findWeek(lines: string[], year: string, weekStart: string): Range | null {
  for (let i = 0; i < lines.length; i++) {
    const m = WEEK_RE.exec(lines[i])
    if (!m) continue
    if (`${year}-${m[1]}-${m[2]}` === weekStart) {
      return { start: i, end: sectionEnd(lines, i, 2) }
    }
  }
  return null
}

function weekInsertIndex(lines: string[], year: string, weekStart: string): number {
  for (let i = 0; i < lines.length; i++) {
    const m = WEEK_RE.exec(lines[i])
    if (!m) continue
    if (`${year}-${m[1]}-${m[2]}` > weekStart) return i
  }
  return lines.length
}

function findDayInWeek(
  lines: string[],
  weekStart: string,
  from: number,
  to: number,
  date: string
): Range | null {
  for (let i = from; i < to; i++) {
    const m = DAY_RE.exec(lines[i])
    if (!m) continue
    if (resolveDayDate(weekStart, `${m[1]}-${m[2]}`) === date) {
      return { start: i, end: sectionEnd(lines, i, 3) }
    }
  }
  return null
}

function dayInsertIndex(
  lines: string[],
  weekStart: string,
  from: number,
  to: number,
  date: string
): number {
  for (let i = from; i < to; i++) {
    const m = DAY_RE.exec(lines[i])
    if (!m) continue
    const resolved = resolveDayDate(weekStart, `${m[1]}-${m[2]}`)
    if (resolved && resolved > date) return i
  }
  return to
}

function insertEntryInDay(lines: string[], day: Range, entryLine: string): void {
  let lastBullet = -1
  for (let i = day.start + 1; i < day.end; i++) {
    if (BULLET_RE.test(lines[i])) lastBullet = i
  }

  if (lastBullet >= 0) {
    lines.splice(lastBullet + 1, 0, entryLine)
    return
  }

  if (day.start + 1 < lines.length && lines[day.start + 1].trim() === '') {
    lines.splice(day.start + 2, 0, entryLine)
  } else {
    lines.splice(day.start + 1, 0, '', entryLine)
  }
}

/**
 * 把一行条目写入指定日期。
 * 文件按周归档：周跨月时整周算作周一所在的那个月。
 */
export function appendEntry(raw: string, month: string, date: string, entryLine: string): string {
  const lines = raw.split('\n')
  const year = month.slice(0, 4)
  const weekStart = weekStartKey(date)

  const week = findWeek(lines, year, weekStart)

  if (!week) {
    insertBlock(lines, weekInsertIndex(lines, year, weekStart), [
      `## ${formatMonthDay(weekStart)} ~ ${formatMonthDay(weekEndKey(date))}`,
      '',
      `### ${formatMonthDay(date)} ${weekdayCn(parseDateKey(date))}`,
      '',
      entryLine
    ])
    return lines.join('\n')
  }

  const day = findDayInWeek(lines, weekStart, week.start + 1, week.end, date)

  if (!day) {
    insertBlock(lines, dayInsertIndex(lines, weekStart, week.start + 1, week.end, date), [
      `### ${formatMonthDay(date)} ${weekdayCn(parseDateKey(date))}`,
      '',
      entryLine
    ])
    return lines.join('\n')
  }

  insertEntryInDay(lines, day, entryLine)
  return lines.join('\n')
}

function locateEntry(raw: string, month: string, date: string, target: EntryTarget): number {
  const doc = parseMonth(month, raw)
  for (const week of doc.weeks) {
    const day = week.days.find((item) => item.date === date)
    if (!day) continue
    const entry = day.entries.find((item) => item.line === target.line)
    if (!entry) continue
    if (entry.raw !== target.raw) throw new Error('条目内容已变化，请刷新后重试')
    return entry.line
  }
  throw new Error('未找到对应条目，文件可能已被外部修改')
}

export function updateEntry(
  raw: string,
  month: string,
  date: string,
  target: EntryTarget,
  entryLine: string
): string {
  const index = locateEntry(raw, month, date, target)
  const lines = raw.split('\n')
  lines[index] = entryLine
  return lines.join('\n')
}

export function removeEntry(
  raw: string,
  month: string,
  date: string,
  target: EntryTarget
): string {
  const index = locateEntry(raw, month, date, target)
  const lines = raw.split('\n')
  lines.splice(index, 1)
  dropEmptySections(lines)
  return lines.join('\n')
}

function isEmptySection(lines: string[], start: number, end: number): boolean {
  for (let i = start + 1; i < end; i++) {
    if (lines[i].trim() !== '') return false
  }
  return true
}

/** 删除条目后，清掉已经空掉的天小节和周小节 */
function dropEmptySections(lines: string[]): void {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!DAY_RE.test(lines[i])) continue
    const end = sectionEnd(lines, i, 3)
    if (isEmptySection(lines, i, end)) lines.splice(i, end - i)
  }
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!WEEK_RE.test(lines[i])) continue
    const end = sectionEnd(lines, i, 2)
    if (isEmptySection(lines, i, end)) lines.splice(i, end - i)
  }
}
