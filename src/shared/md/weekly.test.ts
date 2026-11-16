import { describe, expect, it } from 'vitest'
import { parseMonth } from './month'
import type { TodoItem } from './todo'
import {
  AUTO_END,
  AUTO_START,
  buildWeeklyBody,
  buildWeeklyFile,
  collectWeekEntries,
  isoWeekKey,
  mergeAutoBlock,
  weekRangeFromKey,
  weekRangeOfDate
} from './weekly'

function todo(partial: Partial<TodoItem>): TodoItem {
  return {
    line: 0,
    raw: '',
    content: '',
    done: false,
    quadrant: 'q1',
    due: null,
    project: null,
    doneDate: null,
    ...partial
  }
}

const monthRaw = [
  '---',
  'month: 2026-11',
  '---',
  '',
  '# 2026 年 11 月',
  '',
  '## 11-16 ~ 11-22',
  '',
  '### 11-16 周一',
  '',
  '- 09:30 [[项目A]] 完成登录联调 #开发',
  '- 10:00 [[项目A]] 完成登录联调 #开发',
  '',
  '### 11-18 周三',
  '',
  '- 14:00 [[项目B]] 与客户沟通',
  '',
  '## 11-23 ~ 11-29',
  '',
  '### 11-23 周一',
  '',
  '- 09:00 [[项目A]] 下周的工作'
].join('\n')

describe('周次计算', () => {
  it('按 ISO 规则给出周编号', () => {
    expect(isoWeekKey('2026-11-16')).toBe('2026-W47')
    expect(isoWeekKey('2026-11-22')).toBe('2026-W47')
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01')
  })

  it('跨年的一周归入下一个 ISO 年', () => {
    expect(isoWeekKey('2025-12-29')).toBe('2026-W01')
    expect(weekRangeOfDate('2026-01-01').start).toBe('2025-12-29')
  })

  it('周键能还原出起止日期', () => {
    const range = weekRangeFromKey('2026-W47')
    expect(range.start).toBe('2026-11-16')
    expect(range.end).toBe('2026-11-22')
    expect(range.title).toBe('2026 年第 47 周')
  })
})

describe('collectWeekEntries', () => {
  it('只收集本周的条目并按日期时间排序', () => {
    const doc = parseMonth('2026-11', monthRaw)
    const entries = collectWeekEntries(doc, '2026-11-16', '2026-11-22')

    expect(entries.map((entry) => entry.content)).toEqual([
      '完成登录联调',
      '完成登录联调',
      '与客户沟通'
    ])
    expect(entries[2].date).toBe('2026-11-18')
  })
})

describe('buildWeeklyBody', () => {
  it('按项目分组、去重并追加下周计划', () => {
    const doc = parseMonth('2026-11', monthRaw)
    const entries = collectWeekEntries(doc, '2026-11-16', '2026-11-22')
    const todos = [
      todo({ content: '提交季度总结', due: '2026-11-20' }),
      todo({ content: '已完成的事', due: '2026-11-19', done: true }),
      todo({ content: '很久以后', due: '2026-12-30' })
    ]

    const body = buildWeeklyBody(entries, todos, '2026-11-22')

    expect(body).toContain('## 项目A\n\n- 11-16 完成登录联调')
    expect(body).toContain('## 项目B\n\n- 11-18 与客户沟通')
    expect(body).toContain('## 下周计划\n\n- [ ] 提交季度总结（截止 11-20）')
    expect(body).not.toContain('已完成的事')
    expect(body).not.toContain('很久以后')
    expect(body.indexOf('项目A')).toBeLessThan(body.indexOf('项目B'))
    expect(body.indexOf('项目B')).toBeLessThan(body.indexOf('下周计划'))
  })

  it('没有项目时归入「其他」', () => {
    const body = buildWeeklyBody(
      [{ date: '2026-11-16', time: '09:00', project: null, content: '整理桌面', tags: [] }],
      [],
      '2026-11-22'
    )
    expect(body).toBe('## 其他\n\n- 11-16 整理桌面')
  })

  it('整周没有记录时给出占位文案', () => {
    expect(buildWeeklyBody([], [], '2026-11-22')).toBe('_本周还没有记录。_')
  })
})

describe('周报文件与自动区块', () => {
  it('生成包含标记的完整文件', () => {
    const file = buildWeeklyFile(weekRangeFromKey('2026-W47'), '## 项目A\n\n- 11-16 完成联调')
    expect(file).toContain('week: 2026-W47')
    expect(file).toContain('range: 2026-11-16 ~ 2026-11-22')
    expect(file).toContain('# 2026 年第 47 周（11-16 ~ 11-22）')
    expect(file).toContain(AUTO_START)
    expect(file).toContain(AUTO_END)
  })

  it('重新生成只替换自动区块，保留手写内容', () => {
    const existing = [
      '---',
      'week: 2026-W47',
      '---',
      '',
      '# 2026 年第 47 周',
      '',
      '## 我的总结',
      '',
      '这周整体顺利。',
      '',
      AUTO_START,
      '## 旧内容',
      AUTO_END,
      '',
      '## 备注',
      '',
      '下班路上想到的点子'
    ].join('\n')

    const next = mergeAutoBlock(existing, '## 新内容\n\n- 新的一条')

    expect(next).toContain('这周整体顺利。')
    expect(next).toContain('下班路上想到的点子')
    expect(next).toContain('## 新内容')
    expect(next).not.toContain('## 旧内容')
    expect(next.indexOf('这周整体顺利。')).toBeLessThan(next.indexOf(AUTO_START))
  })

  it('没有标记时追加到末尾', () => {
    const next = mergeAutoBlock('# 我的周报\n\n手动内容', '## 项目A\n\n- 一条')
    expect(next.startsWith('# 我的周报\n\n手动内容')).toBe(true)
    expect(next).toContain(AUTO_START)
    expect(next).toContain('## 项目A')
  })
})
