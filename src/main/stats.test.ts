import { describe, expect, it } from 'vitest'
import { parseMonth } from '@shared/md/month'
import { MAX_GAP_MINUTES, computeStats, monthsBetween } from './stats'

const raw = [
  '## 11-16 ~ 11-22',
  '',
  '### 11-16 周一',
  '',
  '- 09:00 [[项目A]] 写代码',
  '- 10:30 [[项目B]] 开会',
  '- 12:00 [[项目A]] 写文档',
  '',
  '### 11-17 周二',
  '',
  '- 09:00 [[项目A]] 早间',
  '- 14:00 [[项目A]] 长时间中断'
].join('\n')

describe('computeStats', () => {
  it('用相邻记录的时间差估算耗时', () => {
    const report = computeStats([parseMonth('2026-11', raw)], '2026-11-16', '2026-11-17')

    expect(report.totalMinutes).toBe(180)
    expect(report.projects).toEqual([
      { project: '项目A', minutes: 90, count: 1 },
      { project: '项目B', minutes: 90, count: 1 }
    ])
    expect(report.days).toEqual([
      { date: '2026-11-16', minutes: 180 }
    ])
    expect(report.entryCount).toBe(5)
  })

  it(`超过 ${MAX_GAP_MINUTES} 分钟的间隔不计入`, () => {
    const report = computeStats([parseMonth('2026-11', raw)], '2026-11-17', '2026-11-17')
    expect(report.totalMinutes).toBe(0)
    expect(report.entryCount).toBe(2)
  })

  it('范围外的记录不参与统计', () => {
    const report = computeStats([parseMonth('2026-11', raw)], '2026-11-15', '2026-11-15')
    expect(report.totalMinutes).toBe(0)
    expect(report.entryCount).toBe(0)
  })

  it('没有时间的记录不计入耗时', () => {
    const doc = parseMonth(
      '2026-11',
      ['## 11-16 ~ 11-22', '', '### 11-16 周一', '', '- 09:00 [[项目A]] 有时间的', '- 没写时间'].join(
        '\n'
      )
    )
    const report = computeStats([doc], '2026-11-16', '2026-11-16')

    expect(report.totalMinutes).toBe(0)
    expect(report.entryCount).toBe(2)
    expect(report.untimedCount).toBe(1)
  })

  it('没有项目的记录归入「其他」', () => {
    const doc = parseMonth(
      '2026-11',
      ['## 11-16 ~ 11-22', '', '### 11-16 周一', '', '- 09:00 杂事', '- 10:00 又一件'].join('\n')
    )
    const report = computeStats([doc], '2026-11-16', '2026-11-16')
    expect(report.projects).toEqual([{ project: '其他', minutes: 60, count: 1 }])
  })
})

describe('monthsBetween', () => {
  it('覆盖跨年跨月的范围', () => {
    expect(monthsBetween('2026-11-20', '2027-01-05')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(monthsBetween('2026-11-01', '2026-11-30')).toEqual(['2026-11'])
  })
})
