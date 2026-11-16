import { describe, expect, it } from 'vitest'
import {
  appendArchiveItems,
  archiveTemplate,
  parseArchive,
  removeArchiveItem,
  serializeArchiveItem
} from './todoArchive'

describe('archiveTemplate', () => {
  it('按月生成标题', () => {
    expect(archiveTemplate('2026-11')).toContain('# 2026 年 11 月完成')
    expect(archiveTemplate('2026-11')).toContain('month: 2026-11')
  })
})

describe('serialize / parse', () => {
  it('序列化后再解析能还原字段', () => {
    const line = serializeArchiveItem({
      content: '完成联调',
      doneDate: '2026-11-16',
      due: null,
      project: '项目A',
      quadrant: 'q3'
    })

    expect(line).toBe('- [x] 完成联调 | done:2026-11-16 | proj:项目A | q:q3')
    expect(parseArchive(line)[0]).toMatchObject({
      content: '完成联调',
      doneDate: '2026-11-16',
      project: '项目A',
      quadrant: 'q3'
    })
  })

  it('保留截止日期，便于恢复', () => {
    const line = serializeArchiveItem({
      content: 'A',
      doneDate: '2026-11-02',
      due: '2026-11-20',
      project: null,
      quadrant: 'q1'
    })

    expect(line).toBe('- [x] A | done:2026-11-02 | due:2026-11-20 | q:q1')
    expect(parseArchive(line)[0].due).toBe('2026-11-20')
  })

  it('未完成的列表项不算归档', () => {
    expect(parseArchive('- [ ] 还没做')).toEqual([])
  })

  it('缺少象限字段时默认第二象限', () => {
    expect(parseArchive('- [x] 某事 | done:2026-11-01')[0].quadrant).toBe('q2')
  })
})

describe('append / remove', () => {
  it('追加时保留模板内容', () => {
    const raw = appendArchiveItems(archiveTemplate('2026-11'), [
      { content: 'A', doneDate: '2026-11-02', due: null, project: null, quadrant: 'q1' }
    ])

    expect(raw).toContain('# 2026 年 11 月完成')
    expect(raw).toContain('- [x] A | done:2026-11-02 | q:q1')
  })

  it('删除时校验原始行', () => {
    const raw = appendArchiveItems(archiveTemplate('2026-11'), [
      { content: 'A', doneDate: '2026-11-02', due: null, project: null, quadrant: 'q1' }
    ])
    const item = parseArchive(raw)[0]

    expect(parseArchive(removeArchiveItem(raw, { line: item.line, raw: item.raw }))).toHaveLength(0)
    expect(() => removeArchiveItem(raw, { line: item.line, raw: '- [x] 别的' })).toThrow()
  })
})
