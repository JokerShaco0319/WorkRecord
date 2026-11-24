import { describe, expect, it } from 'vitest'
import { parseMonth } from './month'
import { buildDailyReport, buildMonthlyReport, collectMonthEntries } from './report'

const DAILY = `---
month: 2026-11
---

# 2026 年 11 月

## 11-16 ~ 11-22

### 11-16 周一

- 09:30 [[项目A]] 完成登录模块联调 #开发
- 11:00 [[项目A]] 修复 token 刷新偶发失败
- 14:20 [[项目B]] 与客户确认二期需求范围
- 20:54 验证按月存储

### 11-17 周二

- 10:00 [[项目A]] 完成登录模块联调 #开发
`

describe('buildDailyReport', () => {
  it('去掉时间标记并按内容数量编号', () => {
    const doc = parseMonth('2026-11', DAILY)
    const entries = doc.weeks[0].days[0].entries

    expect(buildDailyReport('2026-11-16', entries)).toBe(
      [
        '# 2026-11-16 工作清单',
        '',
        '1. [[项目A]] 完成登录模块联调 #开发',
        '2. [[项目A]] 修复 token 刷新偶发失败',
        '3. [[项目B]] 与客户确认二期需求范围',
        '4. 验证按月存储'
      ].join('\n')
    )
  })

  it('没有记录时只保留标题', () => {
    expect(buildDailyReport('2026-11-16', [])).toBe('# 2026-11-16 工作清单')
  })
})

describe('buildMonthlyReport', () => {
  it('按项目分类，相同日期的重复内容只保留一条', () => {
    const doc = parseMonth('2026-11', DAILY)
    const entries = collectMonthEntries([doc], '2026-11')

    expect(buildMonthlyReport('2026-11', entries)).toBe(
      [
        '# 2026 年 11 月 月报',
        '',
        '## 项目A',
        '',
        '- 11-16 完成登录模块联调',
        '- 11-16 修复 token 刷新偶发失败',
        '- 11-17 完成登录模块联调',
        '',
        '## 项目B',
        '',
        '- 11-16 与客户确认二期需求范围',
        '',
        '## 其他',
        '',
        '- 11-16 验证按月存储'
      ].join('\n')
    )
  })

  it('只收集指定月份的日期', () => {
    const doc = parseMonth('2026-11', DAILY)
    const entries = collectMonthEntries([doc], '2026-12')

    expect(entries).toEqual([])
    expect(buildMonthlyReport('2026-12', entries)).toBe('# 2026 年 12 月 月报\n\n本月还没有记录。')
  })
})
