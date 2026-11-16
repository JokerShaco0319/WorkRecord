import type { Quadrant } from './todo'

export interface ArchiveItem {
  line: number
  raw: string
  content: string
  doneDate: string | null
  due: string | null
  project: string | null
  quadrant: Quadrant
}

export interface ArchiveTarget {
  line: number
  raw: string
}

export type ArchiveInput = Omit<ArchiveItem, 'line' | 'raw'>

const BULLET_RE = /^\s*-\s+(.*)$/
const CHECKBOX_RE = /^\[([ xX])\]\s*/
const FENCE_RE = /^\s*```/
const META_RE = /^(due|proj|done|q):(.+)$/
const QUADRANT_KEYS: Quadrant[] = ['q1', 'q2', 'q3', 'q4']

export function archiveTemplate(month: string): string {
  const [year, monthNumber] = month.split('-')
  return `---\nmonth: ${month}\n---\n\n# ${year} 年 ${Number(monthNumber)} 月完成\n`
}

export function serializeArchiveItem(item: ArchiveInput): string {
  const parts = ['-', '[x]', item.content.trim()]
  if (item.doneDate) parts.push(`| done:${item.doneDate}`)
  if (item.due) parts.push(`| due:${item.due}`)
  if (item.project) parts.push(`| proj:${item.project}`)
  parts.push(`| q:${item.quadrant}`)
  return parts.join(' ')
}

export function parseArchive(raw: string): ArchiveItem[] {
  const lines = raw.split('\n')
  const items: ArchiveItem[] = []
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const bullet = BULLET_RE.exec(line)
    if (!bullet) continue

    let rest = bullet[1]
    const check = CHECKBOX_RE.exec(rest)
    if (!check || check[1].toLowerCase() !== 'x') continue
    rest = rest.slice(check[0].length)

    const contentParts: string[] = []
    let doneDate: string | null = null
    let due: string | null = null
    let project: string | null = null
    let quadrant: Quadrant = 'q2'

    for (const segment of rest.split('|').map((part) => part.trim())) {
      const meta = META_RE.exec(segment)
      if (!meta) {
        contentParts.push(segment)
        continue
      }
      const value = meta[2].trim()
      if (meta[1] === 'done') doneDate = value
      else if (meta[1] === 'due') due = value
      else if (meta[1] === 'proj') project = value
      else if (meta[1] === 'q' && QUADRANT_KEYS.includes(value as Quadrant)) {
        quadrant = value as Quadrant
      }
    }

    const content = contentParts.join(' | ').trim()
    if (!content) continue

    items.push({ line: i, raw: line, content, doneDate, due, project, quadrant })
  }

  return items
}

export function appendArchiveItems(raw: string, items: ArchiveInput[]): string {
  const trimmed = raw.replace(/\s+$/, '')
  const lines = trimmed ? trimmed.split('\n') : []
  const last = lines[lines.length - 1]?.trim() ?? ''
  if (last.startsWith('#')) lines.push('')

  for (const item of items) lines.push(serializeArchiveItem(item))
  return `${lines.join('\n')}\n`
}

export function removeArchiveItem(raw: string, target: ArchiveTarget): string {
  const item = parseArchive(raw).find((entry) => entry.line === target.line)
  if (!item) throw new Error('未找到对应的归档事项，文件可能已被外部修改')
  if (item.raw !== target.raw) throw new Error('归档内容已变化，请刷新后重试')

  const lines = raw.split('\n')
  lines.splice(item.line, 1)
  return lines.join('\n')
}
