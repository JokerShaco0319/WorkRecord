import { FENCE_RE, frontmatterEnd, headingLevel, insertBlock, sectionEnd } from './section'

export type Quadrant = 'q1' | 'q2' | 'q3' | 'q4'

export const QUADRANTS: Array<{ key: Quadrant; title: string; hint: string }> = [
  { key: 'q1', title: '重要且紧急', hint: '马上做' },
  { key: 'q2', title: '重要但不紧急', hint: '计划做' },
  { key: 'q3', title: '紧急但不重要', hint: '尽快处理' },
  { key: 'q4', title: '不重要也不紧急', hint: '有空再说' }
]

export interface TodoItem {
  line: number
  raw: string
  content: string
  done: boolean
  quadrant: Quadrant
  due: string | null
  project: string | null
  doneDate: string | null
}

export interface TodoDoc {
  raw: string
  items: TodoItem[]
}

export interface TodoInput {
  content: string
  due?: string | null
  project?: string | null
}

export interface TodoTarget {
  line: number
  raw: string
}

const BULLET_RE = /^\s*-\s+(.*)$/
const CHECKBOX_RE = /^\[([ xX])\]\s*/
const META_RE = /^(due|proj|done):(.+)$/

function titleOf(quadrant: Quadrant): string {
  return QUADRANTS.find((item) => item.key === quadrant)?.title ?? quadrant
}

export function todoTemplate(): string {
  const body = QUADRANTS.map((item) => `## ${item.title}\n`).join('\n')
  return `# 待办清单\n\n${body}`
}

export function parseTodoItem(line: string, index: number, quadrant: Quadrant): TodoItem | null {
  const bullet = BULLET_RE.exec(line)
  if (!bullet) return null

  let rest = bullet[1]
  let done = false

  const check = CHECKBOX_RE.exec(rest)
  if (check) {
    done = check[1].toLowerCase() === 'x'
    rest = rest.slice(check[0].length)
  }

  const contentParts: string[] = []
  let due: string | null = null
  let project: string | null = null
  let doneDate: string | null = null

  for (const segment of rest.split('|').map((part) => part.trim())) {
    const meta = META_RE.exec(segment)
    if (!meta) {
      contentParts.push(segment)
      continue
    }
    const value = meta[2].trim()
    if (meta[1] === 'due') due = value
    else if (meta[1] === 'proj') project = value
    else doneDate = value
  }

  const content = contentParts.join(' | ').trim()
  if (!content) return null

  return { line: index, raw: line, content, done, quadrant, due, project, doneDate }
}

export function parseTodo(raw: string): TodoDoc {
  const lines = raw.split('\n')
  const bodyStart = frontmatterEnd(lines)
  const items: TodoItem[] = []
  let inFence = false

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i]
    if (FENCE_RE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    if (headingLevel(line) !== 2) continue

    const title = line.replace(/^##\s+/, '').trim()
    const quadrant = QUADRANTS.find((item) => item.title === title)?.key
    if (!quadrant) continue

    const end = sectionEnd(lines, i, 2)
    let fence = false
    for (let j = i + 1; j < end; j++) {
      if (FENCE_RE.test(lines[j])) {
        fence = !fence
        continue
      }
      if (fence) continue
      const item = parseTodoItem(lines[j], j, quadrant)
      if (item) items.push(item)
    }

    i = end - 1
  }

  return { raw, items }
}

export function serializeTodoItem(
  content: string,
  options: {
    done?: boolean
    due?: string | null
    project?: string | null
    doneDate?: string | null
  } = {}
): string {
  const parts = ['-', options.done ? '[x]' : '[ ]', content.trim()]
  if (options.done && options.doneDate) parts.push(`| done:${options.doneDate}`)
  if (options.due) parts.push(`| due:${options.due}`)
  if (options.project) parts.push(`| proj:${options.project}`)
  return parts.join(' ')
}

function findSection(
  lines: string[],
  quadrant: Quadrant
): { start: number; end: number } | null {
  const title = titleOf(quadrant)
  for (let i = 0; i < lines.length; i++) {
    if (headingLevel(lines[i]) !== 2) continue
    if (lines[i].replace(/^##\s+/, '').trim() !== title) continue
    return { start: i, end: sectionEnd(lines, i, 2) }
  }
  return null
}

function insertTodoLine(lines: string[], quadrant: Quadrant, line: string): void {
  const section = findSection(lines, quadrant)
  if (!section) {
    insertBlock(lines, lines.length, [`## ${titleOf(quadrant)}`, '', line])
    return
  }

  let i = section.end - 1
  while (i > section.start && lines[i].trim() === '') i--
  lines.splice(i + 1, 0, line)
}

function locateItem(raw: string, target: TodoTarget): TodoItem {
  const item = parseTodo(raw).items.find((entry) => entry.line === target.line)
  if (!item) throw new Error('未找到对应待办，文件可能已被外部修改')
  if (item.raw !== target.raw) throw new Error('待办内容已变化，请刷新后重试')
  return item
}

export function addTodo(raw: string, quadrant: Quadrant, input: TodoInput): string {
  const lines = raw.split('\n')
  insertTodoLine(
    lines,
    quadrant,
    serializeTodoItem(input.content, { due: input.due, project: input.project })
  )
  return lines.join('\n')
}

export function updateTodo(raw: string, target: TodoTarget, input: TodoInput): string {
  const item = locateItem(raw, target)
  const lines = raw.split('\n')
  lines[item.line] = serializeTodoItem(input.content, {
    done: item.done,
    doneDate: item.doneDate,
    due: input.due,
    project: input.project
  })
  return lines.join('\n')
}

export function removeTodo(raw: string, target: TodoTarget): string {
  const item = locateItem(raw, target)
  const lines = raw.split('\n')
  lines.splice(item.line, 1)
  return lines.join('\n')
}

export function moveTodo(raw: string, target: TodoTarget, quadrant: Quadrant): string {
  const item = locateItem(raw, target)
  if (item.quadrant === quadrant) return raw

  const lines = raw.split('\n')
  const [line] = lines.splice(item.line, 1)
  insertTodoLine(lines, quadrant, line)
  return lines.join('\n')
}

export function toggleTodo(raw: string, target: TodoTarget, today: string): string {
  const item = locateItem(raw, target)
  const lines = raw.split('\n')
  lines[item.line] = serializeTodoItem(item.content, {
    done: !item.done,
    doneDate: item.done ? null : today,
    due: item.due,
    project: item.project
  })
  return lines.join('\n')
}
