import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import type { ProjectDetail, ProjectFileInfo, ProjectSummary } from '@shared/api'
import {
  DEFAULT_CATEGORIES,
  addCategoryToRaw,
  parseProject,
  projectTemplate
} from '@shared/md/project'

const PROJECT_FILE = '_project.md'
const INVALID_SEGMENT = /[\\/:*?"<>|]/

export function assertSegment(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label}不能为空`)
  if (trimmed.startsWith('.') || INVALID_SEGMENT.test(trimmed)) {
    throw new Error(`${label}包含非法字符`)
  }
  return trimmed
}

export function projectsRoot(vaultPath: string): string {
  return join(vaultPath, 'projects')
}

export function projectDirPath(vaultPath: string, project: string): string {
  return join(projectsRoot(vaultPath), assertSegment(project, '项目名'))
}

export function projectFilePath(
  vaultPath: string,
  project: string,
  category: string,
  fileName: string
): string {
  return join(
    projectDirPath(vaultPath, project),
    assertSegment(category, '分类名'),
    assertSegment(fileName, '文件名')
  )
}

export async function createProject(
  vaultPath: string,
  name: string,
  created: string
): Promise<void> {
  const dir = projectDirPath(vaultPath, name)
  if (existsSync(dir)) throw new Error('同名项目已存在')

  await mkdir(dir, { recursive: true })
  for (const category of DEFAULT_CATEGORIES) {
    await mkdir(join(dir, category), { recursive: true })
  }
  await writeFile(join(dir, PROJECT_FILE), projectTemplate(name.trim(), created), 'utf-8')
}

export async function readProject(vaultPath: string, name: string): Promise<ProjectDetail> {
  const dir = projectDirPath(vaultPath, name)

  let meta = { created: '', categories: [...DEFAULT_CATEGORIES] }
  let description = ''
  try {
    const doc = parseProject(await readFile(join(dir, PROJECT_FILE), 'utf-8'))
    meta = doc.meta
    description = doc.description
  } catch {
    // 元文件缺失时按默认分类展示
  }

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const folders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const categories = [...meta.categories]
  for (const folder of folders) {
    if (!categories.includes(folder)) categories.push(folder)
  }

  const files: ProjectFileInfo[] = []
  for (const category of categories) {
    const folderPath = join(dir, category)
    const items = await readdir(folderPath, { withFileTypes: true }).catch(() => [])
    for (const item of items) {
      if (!item.isFile()) continue
      const info = await stat(join(folderPath, item.name))
      files.push({
        category,
        name: item.name,
        size: info.size,
        modified: info.mtime.toISOString()
      })
    }
  }

  files.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  const updatedAt = files.reduce<string | null>(
    (latest, file) => (!latest || file.modified > latest ? file.modified : latest),
    null
  )

  return {
    name: name.trim(),
    description,
    categories,
    fileCount: files.length,
    updatedAt,
    files
  }
}

export async function listProjects(vaultPath: string): Promise<ProjectSummary[]> {
  const entries = await readdir(projectsRoot(vaultPath), { withFileTypes: true }).catch(() => [])
  const projects: ProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const detail = await readProject(vaultPath, entry.name).catch(() => null)
    if (!detail) continue
    const { files: _files, ...summary } = detail
    projects.push(summary)
  }

  projects.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return projects
}

export async function addCategory(
  vaultPath: string,
  name: string,
  category: string,
  created: string
): Promise<void> {
  const dir = projectDirPath(vaultPath, name)
  const trimmed = assertSegment(category, '分类名')

  await mkdir(join(dir, trimmed), { recursive: true })

  const metaPath = join(dir, PROJECT_FILE)
  let raw: string
  try {
    raw = await readFile(metaPath, 'utf-8')
  } catch {
    raw = projectTemplate(name.trim(), created)
  }

  if (!parseProject(raw).meta.categories.includes(trimmed)) {
    await writeFile(metaPath, addCategoryToRaw(raw, trimmed), 'utf-8')
  }
}

async function uniqueTargetPath(dir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let candidate = fileName
  let index = 1
  while (existsSync(join(dir, candidate))) {
    candidate = `${base} (${index})${ext}`
    index++
  }
  return join(dir, candidate)
}

export async function importFiles(
  vaultPath: string,
  project: string,
  category: string,
  sourcePaths: string[]
): Promise<void> {
  const dir = join(projectDirPath(vaultPath, project), assertSegment(category, '分类名'))
  await mkdir(dir, { recursive: true })

  for (const source of sourcePaths) {
    const info = await stat(source).catch(() => null)
    if (!info || !info.isFile()) continue

    const target = await uniqueTargetPath(dir, basename(source))
    if (resolve(target) === resolve(source)) continue
    await copyFile(source, target)
  }
}
