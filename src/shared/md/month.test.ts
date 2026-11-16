import { describe, expect, it } from 'vitest'
import { monthKeyForDate, weekStartKey } from '../date'
import {
  appendEntry,
  dayDoc,
  monthTemplate,
  parseEntryLine,
  parseMonth,
  removeEntry,
  serializeEntry,
  updateEntry
} from './month'

describe('周与月的归属规则', () => {
  it('周一为一周起点', () => {
    expect(weekStartKey('2026-11-16')).toBe('2026-11-16')
    expect(weekStartKey('2026-11-22')).toBe('2026-11-16')
  })

  it('跨月的一周归属周一所在的月份', () => {
    expect(weekStartKey('2026-02-01')).toBe('2026-01-26')
    expect(monthKeyForDate('2026-02-01')).toBe('2026-01')
    expect(monthKeyForDate('2026-02-02')).toBe('2026-02')
  })

  it('跨年的一周归属上一年的月份', () => {
    expect(weekStartKey('2026-01-01')).toBe('2025-12-29')
    expect(monthKeyForDate('2026-01-01')).toBe('2025-12')
  })
})

describe('parseEntryLine', () => {
  it('解析时间、项目、标签与完成状态', () => {
    const entry = parseEntryLine('- [x] 09:30 [[项目A]] 完成登录模块联调 #开发 #收尾', 3)
    expect(entry).toMatchObject({
      time: '09:30',
      project: '项目A',
      content: '完成登录模块联调',
      tags: ['开发', '收尾'],
      done: true,
      line: 3
    })
  })

  it('允许省略时间与项目', () => {
    expect(parseEntryLine('- 整理了本周会议纪要', 0)).toMatchObject({
      time: null,
      project: null,
      content: '整理了本周会议纪要'
    })
  })

  it('非列表行不视为条目', () => {
    expect(parseEntryLine('## 11-02 ~ 11-08', 0)).toBeNull()
    expect(parseEntryLine('普通段落', 0)).toBeNull()
  })
})

describe('parseMonth', () => {
  it('按月 → 周 → 天解析条目', () => {
    const raw = [
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
      '- 09:30 [[项目A]] 完成登录模块联调 #开发',
      '- 11:00 修复 token 问题',
      '',
      '### 11-17 周二',
      '',
      '- 10:00 写接口文档'
    ].join('\n')

    const doc = parseMonth('2026-11', raw)
    expect(doc.weeks).toHaveLength(1)
    expect(doc.weeks[0].start).toBe('2026-11-16')
    expect(doc.weeks[0].end).toBe('2026-11-22')
    expect(doc.weeks[0].days.map((day) => day.date)).toEqual(['2026-11-16', '2026-11-17'])
    expect(dayDoc(doc, '2026-11-16').entries.map((entry) => entry.content)).toEqual([
      '完成登录模块联调',
      '修复 token 问题'
    ])
    expect(dayDoc(doc, '2026-11-17').entries[0].content).toBe('写接口文档')
  })

  it('跨月的一周在当月文件中解析出次月日期', () => {
    const raw = [
      '---',
      'month: 2026-01',
      '---',
      '',
      '# 2026 年 1 月',
      '',
      '## 01-26 ~ 02-01',
      '',
      '### 01-26 周一',
      '',
      '- 09:30 一月最后一周',
      '',
      '### 02-01 周日',
      '',
      '- 10:00 跨月条目'
    ].join('\n')

    const doc = parseMonth('2026-01', raw)
    expect(doc.weeks[0].days.map((day) => day.date)).toEqual(['2026-01-26', '2026-02-01'])
    expect(dayDoc(doc, '2026-02-01').entries[0].content).toBe('跨月条目')
  })

  it('跨年的一周在上一年的文件中解析出次年日期', () => {
    const raw = [
      '---',
      'month: 2025-12',
      '---',
      '',
      '# 2025 年 12 月',
      '',
      '## 12-29 ~ 01-04',
      '',
      '### 01-01 周四',
      '',
      '- 09:00 元旦当天记录'
    ].join('\n')

    const doc = parseMonth('2025-12', raw)
    expect(doc.weeks[0].days[0].date).toBe('2026-01-01')
    expect(dayDoc(doc, '2026-01-01').entries).toHaveLength(1)
  })

  it('忽略代码块中的内容', () => {
    const raw = [
      '## 11-16 ~ 11-22',
      '',
      '### 11-16 周一',
      '',
      '- 09:30 真实条目',
      '```',
      '- 09:40 代码块示例',
      '```'
    ].join('\n')

    expect(parseMonth('2026-11', raw).weeks[0].days[0].entries).toHaveLength(1)
  })

  it('新月份模板没有周与条目', () => {
    const doc = parseMonth('2026-11', monthTemplate('2026-11'))
    expect(doc.weeks).toEqual([])
  })
})

describe('serializeEntry / 往返', () => {
  it('序列化后再解析应还原字段', () => {
    const input = {
      time: '14:20',
      project: '项目B',
      content: '与客户确认二期范围',
      tags: ['沟通']
    }
    const line = serializeEntry(input)
    expect(line).toBe('- 14:20 [[项目B]] 与客户确认二期范围 #沟通')
    expect(parseEntryLine(line, 0)).toMatchObject(input)
  })
})

describe('appendEntry', () => {
  it('空月份中创建周与当天小节', () => {
    const next = appendEntry(monthTemplate('2026-11'), '2026-11', '2026-11-16', '- 09:30 完成联调')
    expect(next).toBe(
      [
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
        '- 09:30 完成联调'
      ].join('\n')
    )
  })

  it('同一天连续追加到小节末尾', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第一条')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 10:00 第二条')

    const entries = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries
    expect(entries.map((entry) => entry.content)).toEqual(['第一条', '第二条'])
    expect(raw).not.toContain('\n\n\n')
  })

  it('新的一周按时间顺序插入到月份中', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第三周')
    raw = appendEntry(raw, '2026-11', '2026-11-09', '- 09:30 第二周')

    const doc = parseMonth('2026-11', raw)
    expect(doc.weeks.map((week) => week.start)).toEqual(['2026-11-09', '2026-11-16'])
  })

  it('周内新增的一天按日期顺序插入', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 周一')
    raw = appendEntry(raw, '2026-11', '2026-11-18', '- 09:30 周三')
    raw = appendEntry(raw, '2026-11', '2026-11-17', '- 09:30 周二')

    const days = parseMonth('2026-11', raw).weeks[0].days
    expect(days.map((day) => day.date)).toEqual(['2026-11-16', '2026-11-17', '2026-11-18'])
  })

  it('跨月日期写入同一周的小节', () => {
    let raw = monthTemplate('2026-01')
    raw = appendEntry(raw, '2026-01', '2026-01-26', '- 09:30 周一')
    raw = appendEntry(raw, '2026-01', '2026-02-01', '- 10:00 周日')

    const doc = parseMonth('2026-01', raw)
    expect(doc.weeks).toHaveLength(1)
    expect(doc.weeks[0].days.map((day) => day.date)).toEqual(['2026-01-26', '2026-02-01'])
    expect(dayDoc(doc, '2026-02-01').entries[0].content).toBe('周日')
  })

  it('用模板新建的月份文件格式稳定', () => {
    const raw = monthTemplate('2026-11')
    expect(raw.startsWith('---\nmonth: 2026-11\n---\n')).toBe(true)
    expect(raw).toContain('# 2026 年 11 月')
  })
})

describe('updateEntry', () => {
  it('按行号替换条目内容', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第一条')
    const entry = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = updateEntry(
      raw,
      '2026-11',
      '2026-11-16',
      { line: entry.line, raw: entry.raw },
      serializeEntry({ time: '09:30', content: '第一条（已改）', done: true })
    )

    const updated = dayDoc(parseMonth('2026-11', next), '2026-11-16').entries[0]
    expect(updated.content).toBe('第一条（已改）')
    expect(updated.done).toBe(true)
  })

  it('原始行不匹配时拒绝修改', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第一条')
    const entry = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    expect(() =>
      updateEntry(raw, '2026-11', '2026-11-16', { line: entry.line, raw: '- 已被外部改动' }, '- 新内容')
    ).toThrow()
  })
})

describe('removeEntry', () => {
  it('删除唯一条目后清掉空的天与周小节', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 唯一一条')
    const entry = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = removeEntry(raw, '2026-11', '2026-11-16', { line: entry.line, raw: entry.raw })

    expect(parseMonth('2026-11', next).weeks).toEqual([])
    expect(next).not.toContain('### ')
    expect(next).not.toContain('## 11-16')
  })

  it('同一天还有其它条目时保留小节', () => {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第一条')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 10:00 第二条')
    const first = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = removeEntry(raw, '2026-11', '2026-11-16', { line: first.line, raw: first.raw })

    const entries = dayDoc(parseMonth('2026-11', next), '2026-11-16').entries
    expect(entries.map((entry) => entry.content)).toEqual(['第二条'])
    expect(next).toContain('### 11-16 周一')
  })

  it('当天还有自由文本时保留小节', () => {
    const raw = [
      '## 11-16 ~ 11-22',
      '',
      '### 11-16 周一',
      '',
      '- 09:30 条目',
      '',
      '随手记一段'
    ].join('\n')
    const entry = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = removeEntry(raw, '2026-11', '2026-11-16', { line: entry.line, raw: entry.raw })

    expect(next).toContain('### 11-16 周一')
    expect(next).toContain('随手记一段')
    expect(next).not.toContain('- 09:30 条目')
  })
})

describe('多周文件中的条目定位', () => {
  function twoWeekMonth(): string {
    let raw = monthTemplate('2026-11')
    raw = appendEntry(raw, '2026-11', '2026-11-09', '- 09:30 第一周')
    raw = appendEntry(raw, '2026-11', '2026-11-16', '- 09:30 第二周')
    return raw
  }

  it('能修改第二周的条目且不影响第一周', () => {
    const raw = twoWeekMonth()
    const target = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = updateEntry(raw, '2026-11', '2026-11-16', target, '- 10:00 第二周已改')

    expect(dayDoc(parseMonth('2026-11', next), '2026-11-16').entries[0].content).toBe('第二周已改')
    expect(dayDoc(parseMonth('2026-11', next), '2026-11-09').entries[0].content).toBe('第一周')
  })

  it('能删除第二周的条目且不影响第一周', () => {
    const raw = twoWeekMonth()
    const target = dayDoc(parseMonth('2026-11', raw), '2026-11-16').entries[0]

    const next = removeEntry(raw, '2026-11', '2026-11-16', target)

    expect(dayDoc(parseMonth('2026-11', next), '2026-11-16').entries).toEqual([])
    expect(dayDoc(parseMonth('2026-11', next), '2026-11-09').entries).toHaveLength(1)
  })
})
