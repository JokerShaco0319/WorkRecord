import { watch, type FSWatcher } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { projectsRoot } from './projects'

const MAX_CONTENT_BYTES = 256 * 1024
const MAX_DEPTH = 8
const MAX_NAME_HITS = 24
const MAX_CONTENT_HITS = 24
const SKIP_DIRS = new Set(['node_modules', '__pycache__'])

const TEXT_EXTENSIONS = new Set([
  'md',
  'markdown',
  'txt',
  'log',
  'csv',
  'tsv',
  'json',
  'jsonc',
  'xml',
  'html',
  'htm',
  'xhtml',
  'css',
  'scss',
  'less',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'vue',
  'svelte',
  'sql',
  'py',
  'java',
  'kt',
  'kts',
  'c',
  'h',
  'cpp',
  'hpp',
  'cc',
  'cs',
  'go',
  'rs',
  'rb',
  'php',
  'sh',
  'bash',
  'zsh',
  'bat',
  'cmd',
  'ps1',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'properties',
  'gradle',
  'jsp',
  'jspf',
  'page',
  'asp',
  'aspx',
  'ftl',
  'vm',
  'tpl',
  'hbs',
  'ejs',
  'pug',
  'tex',
  'r',
  'lua',
  'pl',
  'swift',
  'scala',
  'dart',
  'groovy'
])

interface IndexedFile {
  project: string
  category: string
  path: string
  name: string
  abs: string
  text: boolean
  size: number
  mtimeMs: number
}

export interface FileIndexHit {
  project: string
  category: string
  path: string
  name: string
  match: 'name' | 'content'
  snippet?: string
}

interface FileIndexOptions {
  /** 测试环境可关闭目录监听，避免文件写入触发后台重建 */
  watch?: boolean
}

function isTextFile(name: string): boolean {
  return TEXT_EXTENSIONS.has(extname(name).slice(1).toLowerCase())
}

async function mapLimit<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>
): Promise<void> {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor]
      cursor += 1
      await task(item)
    }
  })
  await Promise.all(workers)
}

async function walkCategory(
  dir: string,
  project: string,
  category: string,
  prefix: string,
  depth: number,
  files: IndexedFile[]
): Promise<void> {
  if (depth > MAX_DEPTH) return

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      await walkCategory(join(dir, entry.name), project, category, relative, depth + 1, files)
      continue
    }

    if (!entry.isFile()) continue
    files.push({
      project,
      category,
      path: relative,
      name: entry.name,
      abs: join(dir, entry.name),
      text: isTextFile(entry.name),
      size: 0,
      mtimeMs: 0
    })
  }
}

async function walkProjects(root: string): Promise<IndexedFile[]> {
  const files: IndexedFile[] = []
  const projects = await readdir(root, { withFileTypes: true }).catch(() => [])

  for (const project of projects) {
    if (!project.isDirectory() || project.name.startsWith('.')) continue
    const projectDir = join(root, project.name)
    const categories = await readdir(projectDir, { withFileTypes: true }).catch(() => [])

    for (const category of categories) {
      if (!category.isDirectory() || category.name.startsWith('.')) continue
      await walkCategory(
        join(projectDir, category.name),
        project.name,
        category.name,
        '',
        0,
        files
      )
    }
  }

  return files
}

function compareHits(a: FileIndexHit, b: FileIndexHit): number {
  return (
    a.project.localeCompare(b.project) ||
    a.category.localeCompare(b.category) ||
    a.path.localeCompare(b.path)
  )
}

/**
 * 项目文件的搜索索引：文件名覆盖全部文件，正文只索引常见文本类型且单文件不超过 256KB。
 * 索引完全从磁盘重建，不写任何派生数据。
 */
export class FileIndex {
  private readonly watchChanges: boolean
  private vaultPath: string | null = null
  private generation = 0
  private files: IndexedFile[] = []
  private content = new Map<string, Buffer>()
  private stamps = new Map<string, string>()
  private ready: Promise<void> = Promise.resolve()
  private watcher: FSWatcher | null = null
  private refreshTimer: NodeJS.Timeout | null = null

  constructor(options: FileIndexOptions = {}) {
    this.watchChanges = options.watch ?? true
  }

  setVault(vaultPath: string | null): void {
    if (this.vaultPath === vaultPath) return

    this.closeWatcher()
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }

    this.generation += 1
    this.vaultPath = vaultPath
    this.files = []
    this.content.clear()
    this.stamps.clear()

    if (!vaultPath) {
      this.ready = Promise.resolve()
      return
    }

    this.ready = this.rebuild(this.generation)
    this.openWatcher()
  }

  async refresh(): Promise<void> {
    const generation = this.generation
    this.ready = this.ready.then(() => this.rebuild(generation))
    await this.ready
  }

  async search(needle: string): Promise<FileIndexHit[]> {
    await this.ready

    const lower = needle.toLowerCase()
    if (!lower) return []

    const needles = Buffer.from(lower, 'utf-8')
    const nameHits: FileIndexHit[] = []
    const contentHits: IndexedFile[] = []
    const named = new Set<string>()

    for (const file of this.files) {
      if (!file.name.toLowerCase().includes(lower)) continue
      named.add(file.abs)
      nameHits.push({
        project: file.project,
        category: file.category,
        path: file.path,
        name: file.name,
        match: 'name'
      })
      if (nameHits.length >= MAX_NAME_HITS) break
    }

    for (const file of this.files) {
      if (named.has(file.abs)) continue
      const text = this.content.get(file.abs)
      if (!text) continue
      if (text.indexOf(needles) < 0) continue
      contentHits.push(file)
      if (contentHits.length >= MAX_CONTENT_HITS) break
    }

    nameHits.sort(compareHits)

    const snippets = await Promise.all(
      contentHits.map((file) => this.snippet(file.abs, lower))
    )

    return [
      ...nameHits,
      ...contentHits
        .map((file, index) => ({
          project: file.project,
          category: file.category,
          path: file.path,
          name: file.name,
          match: 'content' as const,
          snippet: snippets[index]
        }))
        .sort(compareHits)
    ]
  }

  dispose(): void {
    this.closeWatcher()
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer)
      this.refreshTimer = null
    }
    this.generation += 1
    this.vaultPath = null
    this.files = []
    this.content.clear()
    this.stamps.clear()
    this.ready = Promise.resolve()
  }

  private async snippet(abs: string, needle: string): Promise<string | undefined> {
    try {
      const raw = await readFile(abs, 'utf-8')
      const at = raw.toLowerCase().indexOf(needle)
      if (at < 0) return undefined

      const start = Math.max(0, at - 30)
      const end = Math.min(raw.length, at + needle.length + 70)
      const text = raw.slice(start, end).replace(/\s+/g, ' ').trim()
      return `${start > 0 ? '…' : ''}${text}${end < raw.length ? '…' : ''}`
    } catch {
      return undefined
    }
  }

  private async rebuild(generation: number): Promise<void> {
    const vaultPath = this.vaultPath
    if (!vaultPath) return

    try {
      const files = await walkProjects(projectsRoot(vaultPath))

      await mapLimit(
        files.filter((file) => file.text),
        32,
        async (file) => {
          const info = await stat(file.abs).catch(() => null)
          if (!info || !info.isFile()) {
            file.text = false
            return
          }
          file.size = info.size
          file.mtimeMs = info.mtimeMs
        }
      )

      const nextContent = new Map<string, Buffer>()
      const nextStamps = new Map<string, string>()
      const pending: IndexedFile[] = []

      for (const file of files) {
        if (!file.text || file.size > MAX_CONTENT_BYTES) continue
        const stamp = `${file.size}:${file.mtimeMs}`
        const existing = this.content.get(file.abs)
        if (existing && this.stamps.get(file.abs) === stamp) {
          nextContent.set(file.abs, existing)
          nextStamps.set(file.abs, stamp)
          continue
        }
        pending.push(file)
      }

      await mapLimit(pending, 8, async (file) => {
        try {
          const raw = await readFile(file.abs)
          const lower = raw.toString('utf-8').toLowerCase()
          nextContent.set(file.abs, Buffer.from(lower, 'utf-8'))
          nextStamps.set(file.abs, `${file.size}:${file.mtimeMs}`)
        } catch {
          // 读不到的文件跳过正文索引，文件名仍然可以搜索
        }
      })

      if (generation !== this.generation || vaultPath !== this.vaultPath) return

      this.files = files
      this.content = nextContent
      this.stamps = nextStamps
    } catch (err) {
      console.error('构建项目文件索引失败：', err)
    }
  }

  private openWatcher(): void {
    if (!this.watchChanges || !this.vaultPath) return

    try {
      const watcher = watch(
        projectsRoot(this.vaultPath),
        { recursive: true },
        () => this.scheduleRefresh()
      )
      watcher.on('error', () => {
        watcher.close()
        if (this.watcher === watcher) this.watcher = null
      })
      watcher.unref()
      this.watcher = watcher
    } catch {
      this.watcher = null
    }
  }

  private closeWatcher(): void {
    this.watcher?.close()
    this.watcher = null
  }

  private scheduleRefresh(): void {
    if (!this.watchChanges) return
    if (this.refreshTimer) clearTimeout(this.refreshTimer)

    const generation = this.generation
    const timer = setTimeout(() => {
      this.refreshTimer = null
      this.ready = this.ready.then(() => this.rebuild(generation))
    }, 800)
    timer.unref()
    this.refreshTimer = timer
  }
}

export const fileIndex = new FileIndex()
