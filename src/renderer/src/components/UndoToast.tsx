import { useEffect } from 'react'

interface Props {
  message: string
  onUndo: () => void
  onDismiss: () => void
}

export default function UndoToast({ message, onUndo, onDismiss }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-ink px-4 py-2 text-[12px] text-paper shadow-[0_8px_24px_rgb(0_0_0_/_0.25)]">
      <span>{message}</span>
      <button
        type="button"
        data-action="undo-delete"
        onClick={onUndo}
        className="font-medium text-accent-soft transition-opacity hover:opacity-70"
      >
        撤销
      </button>
    </div>
  )
}
