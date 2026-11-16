import { frontmatterEnd } from './section'

export const DEFAULT_CATEGORIES = ['需求', '设计', '开发', '资料', '归档']

export interface ProjectMeta {
  created: string
  categories: string[]
}

export interface ProjectDoc {
  meta: ProjectMeta
  description: string
}

type FrontmatterValue = string | string[]

function parseFrontmatter(raw: string): { data: Record<string, FrontmatterValue>; body: string } {
  const match = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/.exec(raw)
  if (!match) return { data: {}, body: raw }

  const data: Record<string, FrontmatterValue> = {}
  let currentKey: string | null = null

  for (const line of match[1].split('\n')) {
    const listItem = /^\s+-\s+(.*)$/.exec(line)
    if (listItem && currentKey) {
      const existing = data[currentKey]
      const values = Array.isArray(existing) ? existing : []
      values.push(listItem[1].trim())
      data[currentKey] = values
      continue
    }

    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line)
    if (pair) {
      currentKey = pair[1]
      const value = pair[2].trim()
      data[currentKey] = value === '' ? [] : value
    }
  }

  return { data, body: raw.slice(match[0].length) }
}

function toList(value: FrontmatterValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function extractDescription(body: string): string {
  const lines = body.split('\n')
  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  if (lines[0]?.startsWith('# ')) lines.shift()
  return lines.join('\n').trim()
}

export function projectTemplate(name: string, created: string): string {
  const categories = DEFAULT_CATEGORIES.map((category) => `  - ${category}`).join('\n')
  return `---\ncreated: ${created}\ncategories:\n${categories}\n---\n\n# ${name}\n`
}

export function parseProject(raw: string): ProjectDoc {
  const { data, body } = parseFrontmatter(raw)
  const categories = toList(data.categories)
  return {
    meta: {
      created: typeof data.created === 'string' ? data.created : '',
      categories: categories.length > 0 ? categories : [...DEFAULT_CATEGORIES]
    },
    description: extractDescription(body)
  }
}

/** 往 frontmatter 的分类列表里追加一项，保持文件其余内容不变 */
export function addCategoryToRaw(raw: string, category: string): string {
  const lines = raw.split('\n')
  const fmEnd = frontmatterEnd(lines)

  if (fmEnd === 0) {
    return `---\ncategories:\n  - ${category}\n---\n\n${raw}`
  }

  const closeIndex = fmEnd - 1
  let categoryLine = -1
  for (let i = 1; i < closeIndex; i++) {
    if (/^categories:/.test(lines[i])) {
      categoryLine = i
      break
    }
  }

  if (categoryLine === -1) {
    lines.splice(closeIndex, 0, 'categories:', `  - ${category}`)
    return lines.join('\n')
  }

  const inline = lines[categoryLine].replace(/^categories:\s*/, '').trim()
  if (inline) {
    const values = inline
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
    lines.splice(categoryLine, 1, 'categories:', ...values.map((v) => `  - ${v}`), `  - ${category}`)
    return lines.join('\n')
  }

  let insertAt = categoryLine + 1
  while (insertAt < closeIndex && /^\s+-\s+/.test(lines[insertAt])) insertAt++
  lines.splice(insertAt, 0, `  - ${category}`)
  return lines.join('\n')
}
