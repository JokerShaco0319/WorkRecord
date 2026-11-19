import { app } from 'electron'
import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * 在开始菜单创建指向应用本体的快捷方式。
 * 便携版指向外层 exe（PORTABLE_EXECUTABLE_FILE），安装版指向当前 exe。
 */
export async function createStartMenuShortcut(): Promise<string> {
  if (process.platform !== 'win32') throw new Error('仅支持 Windows')
  if (!app.isPackaged) throw new Error('请在安装版或便携版中使用此功能')

  const target = process.env.PORTABLE_EXECUTABLE_FILE || app.getPath('exe')
  const programs = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs')
  const link = join(programs, 'WorkRecord.lnk')

  const quote = (value: string): string => value.replace(/'/g, "''")
  const script = [
    '$shell = New-Object -ComObject WScript.Shell',
    `$shortcut = $shell.CreateShortcut('${quote(link)}')`,
    `$shortcut.TargetPath = '${quote(target)}'`,
    `$shortcut.WorkingDirectory = '${quote(dirname(target))}'`,
    `$shortcut.IconLocation = '${quote(target)},0'`,
    "$shortcut.Description = 'WorkRecord'",
    '$shortcut.Save()'
  ].join('; ')

  await run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true
  })
  return link
}
