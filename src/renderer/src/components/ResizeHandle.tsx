import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from 'react'
import { clampValue } from '@shared/layout'

interface Props {
  value: number
  min: number
  max: number
  defaultValue: number
  unit?: 'px' | 'percent'
  step?: number
  containerRef?: RefObject<HTMLElement | null>
  onPreview: (value: number) => void
  onCommit: (value: number) => void
  ariaLabel: string
  className?: string
}

export default function ResizeHandle({
  value,
  min,
  max,
  defaultValue,
  unit = 'px',
  step,
  containerRef,
  onPreview,
  onCommit,
  ariaLabel,
  className = ''
}: Props) {
  const [active, setActive] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => cleanupRef.current?.()
  }, [])

  function valueFromPointer(clientX: number, startValue: number, startX: number): number {
    if (unit === 'percent') {
      const rect = containerRef?.current?.getBoundingClientRect()
      if (!rect || rect.width <= 0) return startValue
      return ((clientX - rect.left) / rect.width) * 100
    }
    return startValue + (clientX - startX)
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return

    event.preventDefault()
    cleanupRef.current?.()

    const element = event.currentTarget
    const startX = event.clientX
    const startValue = value
    const previousCursor = document.body.style.cursor
    const previousSelect = document.body.style.userSelect
    let latest = startValue

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    setActive(true)

    try {
      element.setPointerCapture(event.pointerId)
    } catch {
      // 合成事件下可能没有可捕获的指针，退化为普通事件监听
    }

    const onMove = (moveEvent: PointerEvent): void => {
      latest = clampValue(
        valueFromPointer(moveEvent.clientX, startValue, startX),
        min,
        max
      )
      onPreview(latest)
    }

    const finish = (endEvent: PointerEvent, cancelled: boolean): void => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onCancel)
      try {
        if (element.hasPointerCapture(endEvent.pointerId)) {
          element.releasePointerCapture(endEvent.pointerId)
        }
      } catch {
        // 指针已被释放时忽略
      }
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
      setActive(false)
      cleanupRef.current = null

      const finalValue = cancelled
        ? latest
        : clampValue(valueFromPointer(endEvent.clientX, startValue, startX), min, max)
      onCommit(finalValue)
    }

    function onUp(upEvent: PointerEvent): void {
      finish(upEvent, false)
    }

    function onCancel(cancelEvent: PointerEvent): void {
      finish(cancelEvent, true)
    }

    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerup', onUp)
    element.addEventListener('pointercancel', onCancel)

    cleanupRef.current = () => {
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerup', onUp)
      element.removeEventListener('pointercancel', onCancel)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousSelect
    }
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const delta = step ?? (unit === 'percent' ? 2 : 16)
    let next: number | null = null

    if (event.key === 'ArrowLeft') next = value - delta
    else if (event.key === 'ArrowRight') next = value + delta
    else if (event.key === 'Home') next = min
    else if (event.key === 'End') next = max
    else return

    event.preventDefault()
    const clamped = clampValue(next, min, max)
    onPreview(clamped)
    onCommit(clamped)
  }

  function reset(): void {
    onPreview(defaultValue)
    onCommit(defaultValue)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      aria-valuetext={`${Math.round(value)}${unit === 'percent' ? '%' : 'px'}`}
      tabIndex={0}
      title="拖拽调整大小，双击恢复默认"
      data-resize-handle={unit}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={reset}
      className={`group relative flex w-1.5 shrink-0 cursor-col-resize touch-none select-none items-center justify-center outline-none focus-visible:bg-accent-soft ${className}`}
    >
      <span
        className={`h-full w-px transition-colors ${
          active ? 'bg-accent' : 'bg-line group-hover:bg-accent'
        }`}
      />
    </div>
  )
}
