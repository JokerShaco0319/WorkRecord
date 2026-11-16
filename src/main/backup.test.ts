import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { backupVault } from './backup'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-backup-'))

  await mkdir(join(vault, 'daily', '2026'), { recursive: true })
  await writeFile(join(vault, 'daily', '2026', '2026-11.md'), '- 完成登录联调', 'utf-8')

  await mkdir(join(vault, 'weekly', '2026'), { recursive: true })
  await writeFile(join(vault, 'weekly', '2026', '2026-W47.md'), '# 第 47 周', 'utf-8')

  await mkdir(join(vault, 'projects', '项目A', '需求'), { recursive: true })
  await writeFile(join(vault, 'projects', '项目A', '_project.md'), '# 项目A', 'utf-8')
  await writeFile(join(vault, 'projects', '项目A', '需求', '说明.md'), '# 说明', 'utf-8')
  await writeFile(join(vault, 'projects', '项目A', '需求', '附件.txt'), 'not markdown', 'utf-8')

  await writeFile(join(vault, 'todo.md'), '# 待办清单', 'utf-8')
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

describe('backupVault', () => {
  it('把 Markdown 记录快照到当天目录', async () => {
    await backupVault(vault, '2026-11-16')
    const target = join(vault, '.workrecord', 'backups', '2026-11-16')

    expect(await readFile(join(target, 'todo.md'), 'utf-8')).toContain('待办清单')
    expect(await readFile(join(target, 'daily', '2026', '2026-11.md'), 'utf-8')).toContain(
      '完成登录联调'
    )
    expect(await readFile(join(target, 'weekly', '2026', '2026-W47.md'), 'utf-8')).toContain(
      '第 47 周'
    )
    expect(
      await readFile(join(target, 'projects', '项目A', '需求', '说明.md'), 'utf-8')
    ).toContain('说明')
  })

  it('不备份非 Markdown 文件', async () => {
    await backupVault(vault, '2026-11-16')
    const target = join(vault, '.workrecord', 'backups', '2026-11-16')
    const names = await readdir(join(target, 'projects', '项目A', '需求'))

    expect(names).toContain('说明.md')
    expect(names).not.toContain('附件.txt')
  })

  it('同一天重复运行不改动已有快照', async () => {
    await backupVault(vault, '2026-11-16')
    await writeFile(join(vault, 'todo.md'), '# 待办清单（已修改）', 'utf-8')
    await backupVault(vault, '2026-11-16')

    const snapshot = await readFile(
      join(vault, '.workrecord', 'backups', '2026-11-16', 'todo.md'),
      'utf-8'
    )
    expect(snapshot).toBe('# 待办清单')
  })

  it('只保留最近 7 份快照', async () => {
    const root = join(vault, '.workrecord', 'backups')
    for (let day = 1; day <= 9; day++) {
      await mkdir(join(root, `2026-11-0${day}`), { recursive: true })
    }

    await backupVault(vault, '2026-11-10')

    const dirs = (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    expect(dirs).toHaveLength(7)
    expect(dirs).toContain('2026-11-10')
    expect(dirs).not.toContain('2026-11-01')
  })
})
