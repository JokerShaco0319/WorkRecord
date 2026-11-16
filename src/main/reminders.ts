import { Notification } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { dueTodos } from '@shared/md/todo'
import { readAppConfig, updateAppConfig } from './vault'

/** 每天最多提醒一次；有到期事项时弹系统通知 */
export async function notifyDueTodos(
  vaultPath: string,
  today: string,
  onOpen: () => void
): Promise<boolean> {
  if (!Notification.isSupported()) return false

  const config = await readAppConfig()
  if (config.lastReminderDate === today) return false

  let raw: string
  try {
    raw = await readFile(join(vaultPath, 'todo.md'), 'utf-8')
  } catch {
    return false
  }

  const due = dueTodos(raw, today)
  if (due.length === 0) return false

  await updateAppConfig({ lastReminderDate: today })

  const preview = due
    .slice(0, 3)
    .map((item) => item.content)
    .join('、')

  const notification = new Notification({
    title: 'WorkRecord 待办提醒',
    body: `有 ${due.length} 项待办已到期：${preview}${due.length > 3 ? ' 等' : ''}`
  })
  notification.on('click', onOpen)
  notification.show()

  return true
}
