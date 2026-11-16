import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { formatDateKey } from '@shared/date'
import { backupVault } from './backup'
import { openCapture } from './capture'
import { registerIpc } from './ipc'
import { readAppConfig } from './vault'

app.setName('WorkRecord')

if (process.env.WORKRECORD_USER_DATA) {
  app.setPath('userData', process.env.WORKRECORD_USER_DATA)
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'WorkRecord',
    backgroundColor: '#f7f6f3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void mainWindow.loadURL(devUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // 仅用于自动化截图验证，设置 WORKRECORD_CAPTURE 后渲染完成即截图退出
  const capturePath = process.env.WORKRECORD_CAPTURE
  if (capturePath) {
    mainWindow.webContents.once('did-finish-load', async () => {
      mainWindow?.show()
      await new Promise((resolve) => setTimeout(resolve, 1500))

      const clickSelectors = process.env.WORKRECORD_CAPTURE_CLICK?.split('|') ?? []
      for (const selector of clickSelectors) {
        await mainWindow?.webContents.executeJavaScript(
          `document.querySelector(${JSON.stringify(selector)})?.click()`
        )
        await new Promise((resolve) => setTimeout(resolve, 600))
      }

      if (process.env.WORKRECORD_CAPTURE_INPUT) {
        const value = JSON.stringify(process.env.WORKRECORD_CAPTURE_INPUT)
        const pressEnter = process.env.WORKRECORD_CAPTURE_NO_ENTER ? 'false' : 'true'
        const inputSelector = process.env.WORKRECORD_CAPTURE_INPUT_SELECTOR
        const resolveInput = inputSelector
          ? `document.querySelector(${JSON.stringify(inputSelector)})`
          : `(document.activeElement && document.activeElement.tagName === 'INPUT' ? document.activeElement : document.querySelector('input'))`
        await mainWindow?.webContents.executeJavaScript(`(() => {
          const input = ${resolveInput}
          if (!input) return
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(input, ${value})
          input.dispatchEvent(new Event('input', { bubbles: true }))
          if (${pressEnter}) {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
          }
        })()`)
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      const image = await mainWindow?.webContents.capturePage()
      if (image) await writeFile(capturePath, image.toPNG())
      app.quit()
    })
  }
}

app.whenReady().then(() => {
  registerIpc(() => mainWindow)
  createWindow()

  globalShortcut.register('CommandOrControl+Shift+Space', () => openCapture())

  void readAppConfig()
    .then((config) => {
      if (config.vaultPath) return backupVault(config.vaultPath, formatDateKey(new Date()))
    })
    .catch(() => {})

  if (process.env.WORKRECORD_OPEN_CAPTURE) openCapture()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
