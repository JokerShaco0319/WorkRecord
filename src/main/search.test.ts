import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FileIndex } from './fileIndex'
import { searchVault } from './search'

let vault: string
let index: FileIndex

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-search-'))
  index = new FileIndex({ watch: false })

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

  await mkdir(join(vault, 'projects', '项目A', '需求', '草图'), { recursive: true })
  await writeFile(
    join(vault, 'projects', '项目A', '需求', '登录需求.md'),
    '# 需求\n\n登录模块需要支持短信验证码',
    'utf-8'
  )
  await writeFile(
    join(vault, 'projects', '项目A', '需求', '草图', '登录流程.md'),
    '# 流程\n\n输入手机号后发送验证码',
    'utf-8'
  )

  await mkdir(join(vault, 'projects', '项目A', '资料'), { recursive: true })
  await writeFile(join(vault, 'projects', '项目A', '资料', '接口文档.pdf'), 'PDF-DATA', 'utf-8')

  await mkdir(join(vault, 'projects', '项目A', '开发'), { recursive: true })
  await writeFile(
    join(vault, 'projects', '项目A', '开发', 'config.sql'),
    '-- 刷新 token\nupdate session set token = 1;',
    'utf-8'
  )
})

afterEach(async () => {
  index.dispose()
  await rm(vault, { recursive: true, force: true })
})

function search(query: string, limit = 60) {
  return searchVault(vault, query, limit, index)
}

describe('searchVault', () => {
  it('空查询返回空结果', async () => {
    expect(await search('   ')).toEqual([])
  })

  it('命中日报条目并带回日期与项目', async () => {
    const hits = await search('登录联调')
    const entry = hits.find((hit) => hit.kind === 'entry')

    expect(entry).toMatchObject({
      kind: 'entry',
      date: '2026-11-16',
      project: '项目A',
      content: '完成登录联调'
    })
  })

  it('命中待办', async () => {
    const hits = await search('支付回调')
    expect(hits[0]).toMatchObject({ kind: 'todo', content: '修复支付回调超时', done: false })
  })

  it('命中周报与项目文件名', async () => {
    const hits = await search('登录')
    const kinds = hits.map((hit) => hit.kind)

    expect(kinds).toContain('entry')
    expect(kinds).toContain('weekly')
    expect(kinds).toContain('project-file')
    expect(
      hits.find((hit) => hit.kind === 'project-file' && hit.name === '登录需求.md')
    ).toMatchObject({
      project: '项目A',
      category: '需求',
      name: '登录需求.md',
      path: '登录需求.md',
      match: 'name'
    })
  })

  it('按类型排序：日报 → 待办 → 周报 → 文件', async () => {
    const hits = await search('登录')
    const order = hits.map((hit) => hit.kind)
    const lastEntry = order.lastIndexOf('entry')
    const firstWeekly = order.indexOf('weekly')

    expect(lastEntry).toBeLessThan(firstWeekly)
  })

  it('文件名搜索覆盖非 md 文件', async () => {
    const hits = await search('接口文档')
    expect(hits).toContainEqual({
      kind: 'project-file',
      project: '项目A',
      category: '资料',
      name: '接口文档.pdf',
      path: '接口文档.pdf',
      match: 'name',
      snippet: undefined
    })
  })

  it('命中项目文件正文并带回片段', async () => {
    const hits = await search('短信验证码')
    const hit = hits.find((item) => item.kind === 'project-file' && item.name === '登录需求.md')

    expect(hit).toMatchObject({
      kind: 'project-file',
      project: '项目A',
      category: '需求',
      name: '登录需求.md',
      path: '登录需求.md',
      match: 'content'
    })
    if (hit?.kind === 'project-file') {
      expect(hit.snippet).toContain('短信验证码')
    }
  })

  it('嵌套目录中的文件带回相对路径', async () => {
    const hits = await search('登录流程')
    const hit = hits.find((item) => item.kind === 'project-file')

    expect(hit).toMatchObject({ name: '登录流程.md', path: '草图/登录流程.md', match: 'name' })
  })

  it('非文本文件只按文件名匹配，不读取正文', async () => {
    await writeFile(join(vault, 'projects', '项目A', '资料', '配置.png'), '刷新 token', 'utf-8')
    await index.refresh()

    const hits = await search('刷新 token')
    const projectFiles = hits.filter((hit) => hit.kind === 'project-file')

    expect(projectFiles.some((hit) => hit.name === '配置.png')).toBe(false)
    expect(projectFiles).toContainEqual(
      expect.objectContaining({ name: 'config.sql', match: 'content' })
    )
  })

  it('超过大小上限的文件不索引正文', async () => {
    const large = 'x'.repeat(300 * 1024) + '超大文件关键字'
    await writeFile(join(vault, 'projects', '项目A', '资料', '大文件.txt'), large, 'utf-8')
    await index.refresh()

    const hits = await search('超大文件关键字')
    expect(hits.some((hit) => hit.kind === 'project-file')).toBe(false)
  })

  it('刷新索引后能搜索到新增文件', async () => {
    expect(await search('月度新增关键字')).toEqual([])

    await writeFile(
      join(vault, 'projects', '项目A', '资料', '新增说明.md'),
      '这里包含月度新增关键字',
      'utf-8'
    )
    await index.refresh()

    const hits = await search('月度新增关键字')
    expect(hits).toContainEqual(
      expect.objectContaining({ kind: 'project-file', name: '新增说明.md', match: 'content' })
    )
  })

  it('正文搜索大小写不敏感', async () => {
    const hits = await search('SESSION')
    expect(hits).toContainEqual(
      expect.objectContaining({ name: 'config.sql', match: 'content' })
    )
  })

  it('遵守数量上限', async () => {
    const hits = await search('登录', 1)
    expect(hits).toHaveLength(1)
  })

  it('大小写不敏感', async () => {
    await writeFile(join(vault, 'projects', '项目A', '开发', 'API-Design.md'), '# x', 'utf-8')
    await index.refresh()

    const hits = await search('api-design')
    expect(hits.some((hit) => hit.kind === 'project-file' && hit.name === 'API-Design.md')).toBe(true)
  })
})
