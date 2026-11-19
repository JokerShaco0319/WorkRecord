import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  archiveNode,
  listArchiveEntries,
  restoreArchiveEntry,
  trashArchiveEntry
} from './archive'
import { createProject, readProject } from './projects'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-archive-'))
  await mkdir(join(vault, 'projects'), { recursive: true })
  await createProject(vault, '项目A', '2026-11-19')
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

async function put(relative: string, content: string): Promise<string> {
  const target = join(vault, 'projects', '项目A', ...relative.split('/'))
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, content, 'utf-8')
  return target
}

describe('归档闭包', () => {
  it('归档 md 时带上相对链接的资产，恢复后回到原位置', async () => {
    const doc = await put('需求/说明.md', '# 说明\n\n![](../资料/图片/a.png)\n')
    const image = await put('资料/图片/a.png', 'png')

    await archiveNode(vault, '项目A', '需求', '说明.md', 'file')

    expect(existsSync(doc)).toBe(false)
    expect(existsSync(image)).toBe(false)

    const entries = await listArchiveEntries(vault, '项目A')
    expect(entries).toHaveLength(1)
    expect(entries[0].files.map((file) => file.path).sort()).toEqual(
      ['需求/说明.md', '资料/图片/a.png'].sort()
    )

    const bases = await readdir(join(vault, 'projects', '项目A', '.archive'))
    const base = join(vault, 'projects', '项目A', '.archive', bases[0])
    expect(existsSync(join(base, '需求', '说明.md'))).toBe(true)
    expect(existsSync(join(base, '资料', '图片', 'a.png'))).toBe(true)

    await restoreArchiveEntry(vault, '项目A', entries[0].id)

    expect(existsSync(doc)).toBe(true)
    expect(existsSync(image)).toBe(true)
    expect(await listArchiveEntries(vault, '项目A')).toEqual([])
    expect(await readFile(doc, 'utf-8')).toContain('../资料/图片/a.png')
  })

  it('被其它文档引用的资产只复制，不移动', async () => {
    await put('需求/a.md', '[图片](../资料/img.png)')
    await put('需求/b.md', '[图片](../资料/img.png)')
    const shared = await put('资料/img.png', 'png')

    await archiveNode(vault, '项目A', '需求', 'a.md', 'file')

    expect(existsSync(shared)).toBe(true)
    const project = await readProject(vault, '项目A')
    expect(project.files.map((file) => `${file.category}/${file.path}`).sort()).toEqual(
      ['资料/img.png', '需求/b.md'].sort()
    )

    const entries = await listArchiveEntries(vault, '项目A')
    expect(entries[0].files.map((file) => file.path).sort()).toEqual(
      ['需求/a.md', '资料/img.png'].sort()
    )
  })

  it('目录归档保留内部结构', async () => {
    await put('资料/草图/a.md', '![](img.png)')
    await put('资料/草图/img.png', 'png')

    await archiveNode(vault, '项目A', '资料', '草图', 'folder')

    const project = await readProject(vault, '项目A')
    expect(project.fileCount).toBe(0)

    const entries = await listArchiveEntries(vault, '项目A')
    expect(entries[0].kind).toBe('folder')
    expect(entries[0].files.map((file) => file.path).sort()).toEqual(
      ['资料/草图/a.md', '资料/草图/img.png'].sort()
    )

    await restoreArchiveEntry(vault, '项目A', entries[0].id)
    expect(existsSync(join(vault, 'projects', '项目A', '资料', '草图', 'a.md'))).toBe(true)
  })

  it('旧版归档仍可列出来并恢复', async () => {
    await put('.archive/需求/旧文件.md', 'old')

    const entries = await listArchiveEntries(vault, '项目A')
    expect(entries).toHaveLength(1)
    expect(entries[0].legacy).toBe(true)

    await restoreArchiveEntry(vault, '项目A', entries[0].id)
    expect(existsSync(join(vault, 'projects', '项目A', '需求', '旧文件.md'))).toBe(true)
  })

  it('删除归档记录会移除整个记录目录', async () => {
    await put('需求/a.md', '![](../资料/img.png)')
    await put('资料/img.png', 'png')
    await archiveNode(vault, '项目A', '需求', 'a.md', 'file')

    const entries = await listArchiveEntries(vault, '项目A')
    await trashArchiveEntry(vault, '项目A', entries[0].id, (target) =>
      rm(target, { recursive: true, force: true })
    )

    expect(await listArchiveEntries(vault, '项目A')).toEqual([])
    expect(await readdir(join(vault, 'projects', '项目A', '.archive'))).toEqual([])
  })
})
