import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { searchVault } from './search'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-search-'))

  await mkdir(join(vault, 'daily', '2026'), { recursive: true })
  await writeFile(
    join(vault, 'daily', '2026', '2026-11.md'),
    [
      '## 11-16 ~ 11-22',
      '',
      '### 11-16 周一',
      '',
      '- 09:30 [[项目A]] 完成登录联调 #开发',
      '- 11:00 [[项目B]] 与客户确认二期范围'
    ].join('\n'),
    'utf-8'
  )

  await writeFile(
    join(vault, 'todo.md'),
    ['# 待办清单', '', '## 重要且紧急', '', '- [ ] 修复支付回调超时 | due:2026-11-18'].join('\n'),
    'utf-8'
  )

  await mkdir(join(vault, 'weekly', '2026'), { recursive: true })
  await writeFile(
    join(vault, 'weekly', '2026', '2026-W47.md'),
    ['# 2026 年第 47 周', '', '## 项目A', '', '- 11-16 完成登录联调'].join('\n'),
    'utf-8'
  )

  await mkdir(join(vault, 'projects', '项目A', '需求'), { recursive: true })
  await writeFile(join(vault, 'projects', '项目A', '需求', '登录需求.md'), '# 需求', 'utf-8')
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

describe('searchVault', () => {
  it('空查询返回空结果', async () => {
    expect(await searchVault(vault, '   ')).toEqual([])
  })

  it('命中日报条目并带回日期与项目', async () => {
    const hits = await searchVault(vault, '登录联调')
    const entry = hits.find((hit) => hit.kind === 'entry')

    expect(entry).toMatchObject({
      kind: 'entry',
      date: '2026-11-16',
      project: '项目A',
      content: '完成登录联调'
    })
  })

  it('命中待办', async () => {
    const hits = await searchVault(vault, '支付回调')
    expect(hits[0]).toMatchObject({ kind: 'todo', content: '修复支付回调超时', done: false })
  })

  it('命中周报与项目文件名', async () => {
    const hits = await searchVault(vault, '登录')
    const kinds = hits.map((hit) => hit.kind)

    expect(kinds).toContain('entry')
    expect(kinds).toContain('weekly')
    expect(kinds).toContain('project-file')
    expect(hits.find((hit) => hit.kind === 'project-file')).toMatchObject({
      project: '项目A',
      category: '需求',
      name: '登录需求.md'
    })
  })

  it('按类型排序：日报 → 待办 → 周报 → 文件', async () => {
    const hits = await searchVault(vault, '登录')
    const order = hits.map((hit) => hit.kind)
    const lastEntry = order.lastIndexOf('entry')
    const firstWeekly = order.indexOf('weekly')

    expect(lastEntry).toBeLessThan(firstWeekly)
  })

  it('遵守数量上限', async () => {
    const hits = await searchVault(vault, '登录', 1)
    expect(hits).toHaveLength(1)
  })

  it('大小写不敏感', async () => {
    await writeFile(join(vault, 'projects', '项目A', '需求', 'API-Design.md'), '# x', 'utf-8')
    const hits = await searchVault(vault, 'api-design')
    expect(hits.some((hit) => hit.kind === 'project-file' && hit.name === 'API-Design.md')).toBe(true)
  })
})
