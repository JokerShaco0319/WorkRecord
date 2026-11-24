export interface UiLayout {
  /** 左侧导航宽度（px） */
  sidebarWidth: number
  /** 源码编辑区的宽度占比（%） */
  sourceSplit: number
}

export const DEFAULT_UI_LAYOUT: UiLayout = {
  sidebarWidth: 212,
  sourceSplit: 50
}

export const UI_LAYOUT_LIMITS = {
  sidebarWidth: { min: 176, max: 320 },
  sourceSplit: { min: 25, max: 75 }
} as const

export function clampValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function pick(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? clampValue(value, min, max)
    : fallback
}

/** 对布局做兜底与 clamp，旧配置缺字段时回落到默认值 */
export function sanitizeUiLayout(
  patch: Partial<UiLayout> | null | undefined,
  base: UiLayout = DEFAULT_UI_LAYOUT
): UiLayout {
  const next = patch ?? {}
  const sidebarWidth = Math.round(
    pick(
      next.sidebarWidth,
      base.sidebarWidth,
      UI_LAYOUT_LIMITS.sidebarWidth.min,
      UI_LAYOUT_LIMITS.sidebarWidth.max
    )
  )
  const sourceSplit = Math.round(
    pick(
      next.sourceSplit,
      base.sourceSplit,
      UI_LAYOUT_LIMITS.sourceSplit.min,
      UI_LAYOUT_LIMITS.sourceSplit.max
    ) * 10
  ) / 10

  return { sidebarWidth, sourceSplit }
}
