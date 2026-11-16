import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { listArchive, migrateCompletedTodos } from './todoArchive'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-archive-'))
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
})

describe('migrateCompletedTodos', () => {
  it('把已完成事项迁移到完成月份', async () => {
    await writeFile(
      join(vault, 'todo.md'),
      [
        '# 待办清单',
        '',
        '## 重要且紧急',
        '',
        '- [ ] 未完成的事',
        '- [x] 写完了接口文档 | done:2026-11-10 | proj:项目A',
        '',
        '## 重要但不紧急',
        '',
        '- [x] 另一件 | done:2026-10-02'
      ].join('\n'),
      'utf-8'
    )

    await migrateCompletedTodos(vault, '2026-11-16')

    const todo = await readFile(join(vault, 'todo.md'), 'utf-8')
    expect(todo).toContain('未完成的事')
    expect(todo).not.toContain('写完了接口文档')
    expect(todo).not.toContain('另一件')

    const november = await listArchive(vault, '2026-11')
    expect(november.map((item) => item.content)).toEqual(['写完了接口文档'])
    expect(november[0].quadrant).toBe('q1')
    expect(november[0].project).toBe('项目A')

    const october = await listArchive(vault, '2026-10')
    expect(october.map((item) => item.content)).toEqual(['另一件'])
  })

  it('没有已完成事项时不改动文件', async () => {
    const content = '# 待办清单\n\n## 重要且紧急\n\n- [ ] 未完成\n'
    await writeFile(join(vault, 'todo.md'), content, 'utf-8')

    await migrateCompletedTodos(vault, '2026-11-16')
    expect(await readFile(join(vault, 'todo.md'), 'utf-8')).toBe(content)
  })

  it('重复执行不会产生重复归档', async () => {
    await writeFile(
      join(vault, 'todo.md'),
      '## 重要且紧急\n\n- [x] 完成的事 | done:2026-11-10\n',
      'utf-8'
    )

    await migrateCompletedTodos(vault, '2026-11-16')
    await migrateCompletedTodos(vault, '2026-11-16')

    expect(await listArchive(vault, '2026-11')).toHaveLength(1)
  })
})
