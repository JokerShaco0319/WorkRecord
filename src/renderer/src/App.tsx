import { useEffect, useState } from 'react'
import type { VaultInfo } from '@shared/api'
import Welcome from './components/Welcome'
import Workspace from './components/Workspace'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export default function App() {
  const [vault, setVault] = useState<VaultInfo | null>(null)
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    let cancelled = false
    window.api.vault.get().then((info) => {
      if (!cancelled) setVault(info)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    window.api.settings
      .get()
      .then((settings) => {
        setTheme(settings.theme)
        applyTheme(settings.theme)
      })
      .catch(() => {})
  }, [])

  async function toggleTheme(): Promise<void> {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    try {
      await window.api.settings.setTheme(next)
    } catch {
      // 保存失败时保留当前界面状态
    }
  }

  if (!vault) {
    return <div className="grid h-full place-items-center text-sm text-muted">正在加载…</div>
  }

  return vault.path ? (
    <Workspace vault={vault} theme={theme} onToggleTheme={() => void toggleTheme()} />
  ) : (
    <Welcome onReady={setVault} />
  )
}
