import { describe, expect, it } from 'vitest'
import {
  clampValue,
  DEFAULT_UI_LAYOUT,
  sanitizeUiLayout,
  UI_LAYOUT_LIMITS
} from './layout'

describe('clampValue', () => {
  it('限制在区间内', () => {
    expect(clampValue(100, 176, 320)).toBe(176)
    expect(clampValue(500, 176, 320)).toBe(320)
    expect(clampValue(240, 176, 320)).toBe(240)
  })

  it('非法值回落到下界', () => {
    expect(clampValue(Number.NaN, 176, 320)).toBe(176)
    expect(clampValue(Number.POSITIVE_INFINITY, 176, 320)).toBe(176)
  })
})

describe('sanitizeUiLayout', () => {
  it('缺省时使用默认布局', () => {
    expect(sanitizeUiLayout(undefined)).toEqual(DEFAULT_UI_LAYOUT)
    expect(sanitizeUiLayout(null)).toEqual(DEFAULT_UI_LAYOUT)
    expect(sanitizeUiLayout({})).toEqual(DEFAULT_UI_LAYOUT)
  })

  it('对上下限做 clamp', () => {
    expect(sanitizeUiLayout({ sidebarWidth: 100, sourceSplit: 10 })).toEqual({
      sidebarWidth: UI_LAYOUT_LIMITS.sidebarWidth.min,
      sourceSplit: UI_LAYOUT_LIMITS.sourceSplit.min
    })
    expect(sanitizeUiLayout({ sidebarWidth: 500, sourceSplit: 90 })).toEqual({
      sidebarWidth: UI_LAYOUT_LIMITS.sidebarWidth.max,
      sourceSplit: UI_LAYOUT_LIMITS.sourceSplit.max
    })
  })

  it('忽略非法值并保留基准值', () => {
    const base = { sidebarWidth: 240, sourceSplit: 60 }
    expect(
      sanitizeUiLayout({ sidebarWidth: Number.NaN, sourceSplit: Number.POSITIVE_INFINITY }, base)
    ).toEqual(base)
  })

  it('部分 patch 只改指定字段', () => {
    const base = { sidebarWidth: 240, sourceSplit: 50 }
    expect(sanitizeUiLayout({ sourceSplit: 33.33 }, base)).toEqual({
      sidebarWidth: 240,
      sourceSplit: 33.3
    })
    expect(sanitizeUiLayout({ sidebarWidth: 212.6 }, base)).toEqual({
      sidebarWidth: 213,
      sourceSplit: 50
    })
  })
})
