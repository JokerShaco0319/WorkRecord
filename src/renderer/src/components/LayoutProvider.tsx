import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { DEFAULT_UI_LAYOUT, sanitizeUiLayout, type UiLayout } from '@shared/layout'

interface LayoutContextValue {
  layout: UiLayout
  preview: (patch: Partial<UiLayout>) => void
  commit: (patch: Partial<UiLayout>) => void
}

const LayoutContext = createContext<LayoutContextValue>({
  layout: DEFAULT_UI_LAYOUT,
  preview: () => {},
  commit: () => {}
})

export function useUiLayout(): LayoutContextValue {
  return useContext(LayoutContext)
}

export default function LayoutProvider({ children }: { children: ReactNode }) {
  const [layout, setLayout] = useState<UiLayout>(DEFAULT_UI_LAYOUT)
  const layoutRef = useRef(layout)
  const dirtyRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef<UiLayout | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.settings
      .get()
      .then((settings) => {
        if (cancelled || dirtyRef.current) return
        const next = sanitizeUiLayout(settings.uiLayout)
        layoutRef.current = next
        setLayout(next)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        const value = pendingRef.current
        if (value) void window.api.settings.setUiLayout(value).catch(() => {})
      }
    }
  }, [])

  const preview = useCallback((patch: Partial<UiLayout>) => {
    dirtyRef.current = true
    setLayout((current) => {
      const next = sanitizeUiLayout(patch, current)
      layoutRef.current = next
      return next
    })
  }, [])

  const commit = useCallback((patch: Partial<UiLayout>) => {
    dirtyRef.current = true
    const next = sanitizeUiLayout(patch, layoutRef.current)
    layoutRef.current = next
    setLayout(next)
    pendingRef.current = next

    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      const value = pendingRef.current
      if (!value) return
      pendingRef.current = null
      void window.api.settings.setUiLayout(value).catch(() => {})
    }, 250)
  }, [])

  return (
    <LayoutContext.Provider value={{ layout, preview, commit }}>
      {children}
    </LayoutContext.Provider>
  )
}
