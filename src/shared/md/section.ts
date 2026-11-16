const HEADING_RE = /^(#{1,6})\s+/
export const FENCE_RE = /^\s*```/

export function headingLevel(line: string): number | null {
  const m = HEADING_RE.exec(line)
  return m ? m[1].length : null
}

/** 从标题行向下找到同级或更高级标题的位置 */
export function sectionEnd(lines: string[], from: number, level: number): number {
  let inFence = false
  for (let i = from + 1; i < lines.length; i++) {
    if (FENCE_RE.test(lines[i])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const current = headingLevel(lines[i])
    if (current !== null && current <= level) return i
  }
  return lines.length
}

/** 返回 frontmatter 之后的第一行行号；没有 frontmatter 时为 0 */
export function frontmatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return 0
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') return i + 1
  }
  return 0
}

/** 去掉文件头部的 frontmatter，用于渲染预览 */
export function stripFrontmatter(raw: string): string {
  const match = /^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/.exec(raw)
  return match ? raw.slice(match[0].length) : raw
}

/** 插入一段内容，并保证与上下相邻块之间留有且只留一个空行 */
export function insertBlock(lines: string[], index: number, block: string[]): void {
  const before = index > 0 ? lines[index - 1] : ''
  const after = index < lines.length ? lines[index] : ''
  const payload: string[] = []
  if (before.trim() !== '') payload.push('')
  payload.push(...block)
  if (after.trim() !== '') payload.push('')
  lines.splice(index, 0, ...payload)
}
