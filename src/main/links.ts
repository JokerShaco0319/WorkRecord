import { posix } from 'node:path'

const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.html', '.htm', '.svg'])
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i

export function isLinkSource(path: string): boolean {
  const index = path.lastIndexOf('.')
  if (index < 0) return false
  return TEXT_EXTENSIONS.has(path.slice(index).toLowerCase())
}

/** 提取文本里可能指向项目内文件的链接，外部 URL 与纯锚点会在解析阶段丢弃 */
export function extractRawLinks(content: string): string[] {
  const links = new Set<string>()

  const inline = /(!?)\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g
  for (const match of content.matchAll(inline)) {
    links.add(match[2])
  }

  const reference = /^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+["'].*)?$/gm
  for (const match of content.matchAll(reference)) {
    links.add(match[1])
  }

  const html = /(?:src|href)\s*=\s*["']([^"']+)["']/gi
  for (const match of content.matchAll(html)) {
    links.add(match[1])
  }

  return [...links]
}

/** 把链接解析成项目相对路径；返回 null 表示外部链接或越界路径 */
export function resolveProjectLink(fromPath: string, rawLink: string): string | null {
  let value = rawLink.trim()
  if (!value) return null
  if (value.startsWith('<') && value.endsWith('>')) value = value.slice(1, -1)
  if (!value || value.startsWith('#') || value.startsWith('//')) return null
  if (URL_SCHEME.test(value)) return null

  const cut = value.search(/[?#]/)
  if (cut >= 0) value = value.slice(0, cut)
  if (!value) return null

  try {
    value = decodeURIComponent(value)
  } catch {
    // 保留原始值
  }

  const fromDir = posix.dirname(fromPath)
  const resolved = value.startsWith('/')
    ? posix.normalize(value.replace(/^\/+/, ''))
    : posix.normalize(posix.join(fromDir === '.' ? '' : fromDir, value))

  if (!resolved || resolved === '.' || resolved.startsWith('..')) return null
  return resolved
}
