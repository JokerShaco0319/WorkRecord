const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatTimeHm(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function weekdayCn(date: Date): string {
  return WEEKDAYS[date.getDay()]
}

/** 用正午构造，避免夏令时导致的跨日偏差 */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDateKey(parseDateKey(value)) === value
}

export function addDaysKey(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

/** 所在周的周一 */
export function weekStartKey(key: string): string {
  const weekday = parseDateKey(key).getDay()
  return addDaysKey(key, weekday === 0 ? -6 : 1 - weekday)
}

export function weekEndKey(key: string): string {
  return addDaysKey(weekStartKey(key), 6)
}

/** 该日期所属周归档到的月份，即周一的月份 */
export function monthKeyForDate(key: string): string {
  return weekStartKey(key).slice(0, 7)
}

/** 'YYYY-MM-DD' -> 'MM-DD' */
export function formatMonthDay(key: string): string {
  return key.slice(5)
}

/** 'YYYY-MM' 加减若干个月 */
export function addMonthsToMonthKey(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
