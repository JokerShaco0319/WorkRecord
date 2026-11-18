import { app, BrowserWindow, Menu, Tray, globalShortcut, nativeImage, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { formatDateKey } from '@shared/date'
import windowIcon from '../../resources/icon.png?asset'
import trayIcon from '../../resources/tray.png?asset'
import { openCapture } from './capture'
import { registerIpc } from './ipc'
import { notifyBackupReminder, notifyDueTodos } from './reminders'
import { migrateCompletedTodos } from './todoArchive'
import { readAppConfig } from './vault'

app.setName('WorkRecord')
app.setAppUserModelId('com.workrecord.app')

/**
 * 应用自身产生的数据（配置、缓存）统一放在可执行文件旁的 data 目录：
 * 安装版 → <安装目录>/data，免安装版 → exe 所在目录/data。
 * 开发态沿用系统默认位置；自动化测试可用 WORKRECORD_USER_DATA 覆盖。
 */
function resolveDataDir(): string | null {
  if (process.env.WORKRECORD_USER_DATA) return process.env.WORKRECORD_USER_DATA
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return join(process.env.PORTABLE_EXECUTABLE_DIR, 'data')
  }
  if (app.isPackaged) return join(dirname(app.getPath('exe')), 'data')
  return null
}

const legacyUserData = app.getPath('userData')
const dataDir = resolveDataDir()

if (dataDir) {
  try {
    mkdirSync(dataDir, { recursive: true })
    app.setPath('userData', dataDir)

    // 老版本配置在 %APPDATA% 下，首次启动搬到新位置，避免丢失数据目录选择
    const legacyConfig = join(legacyUserData, 'config.json')
    const dataConfig = join(dataDir, 'config.json')
    if (!existsSync(dataConfig) && existsSync(legacyConfig)) {
      copyFileSync(legacyConfig, dataConfig)
    }
  } catch (err) {
    console.error('无法在应用目录写入数据，回退到系统默认位置：', err)
  }
}

// 只允许一个实例：重复启动时把已有窗口唤到前台
const isPrimaryInstance = app.requestSingleInstanceLock()
if (!isPrimaryInstance) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
let windowTheme: 'light' | 'dark' = 'light'

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createTray(): void {
  if (tray) return

  tray = new Tray(nativeImage.createFromPath(trayIcon))
  tray.setToolTip('WorkRecord')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开 WorkRecord', click: showMainWindow },
      { label: '快速记录', click: () => openCapture() },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          isQuitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showMainWindow)
}

function createWindow(): void {
  const startHidden = process.argv.includes('--hidden')

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: !startHidden,
    title: 'WorkRecord',
    icon: windowIcon,
    backgroundColor: windowTheme === 'dark' ? '#1b1a18' : '#f7f6f3',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow?.hide()
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
      const captureDelay = Number(process.env.WORKRECORD_CAPTURE_DELAY ?? 1500)
      await new Promise((resolve) => setTimeout(resolve, Number.isFinite(captureDelay) ? captureDelay : 1500))

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

      const fillPayload = process.env.WORKRECORD_CAPTURE_FILL
      if (fillPayload) {
        const steps = JSON.parse(fillPayload) as Array<{
          click?: string
          script?: string
          selector?: string
          index?: number
          value?: string
          enter?: boolean
        }>

        for (const step of steps) {
          if (step.click) {
            await mainWindow?.webContents.executeJavaScript(
              `document.querySelector(${JSON.stringify(step.click)})?.click()`
            )
          } else if (step.script) {
            await mainWindow?.webContents.executeJavaScript(step.script)
          } else if (step.value !== undefined) {
            const selector = step.selector ?? 'input'
            const index = step.index ?? 0
            const pressEnter = step.enter
              ? "el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))"
              : ''

            await mainWindow?.webContents.executeJavaScript(`(() => {
              const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
              if (!el) return
              const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
              setter.call(el, ${JSON.stringify(step.value)})
              el.dispatchEvent(new Event('input', { bubbles: true }))
              ${pressEnter}
            })()`)
          }

          await new Promise((resolve) => setTimeout(resolve, 600))
        }
      }

      const image = await mainWindow?.webContents.capturePage()
      if (image) await writeFile(capturePath, image.toPNG())
      app.quit()
    })
  }
}

app.whenReady().then(() => {
  if (!isPrimaryInstance) return

  registerIpc(() => mainWindow)
  createTray()

  globalShortcut.register('CommandOrControl+Shift+Space', () => openCapture())

  void readAppConfig()
    .then(async (config) => {
      windowTheme = config.theme
      createWindow()

      if (!config.vaultPath) return
      const today = formatDateKey(new Date())
      await migrateCompletedTodos(config.vaultPath, today)
      await notifyDueTodos(config.vaultPath, today, showMainWindow).catch(() => false)
    })
    .catch(() => {
      createWindow()
    })

  setInterval(() => {
    void readAppConfig()
      .then((config) => {
        if (!config.vaultPath) return
        return notifyDueTodos(config.vaultPath, formatDateKey(new Date()), showMainWindow)
      })
      .catch(() => {})
  }, 4 * 60 * 60 * 1000)

  const checkBackupReminder = (): void => {
    void readAppConfig()
      .then((config) => {
        if (!config.vaultPath) return
        return notifyBackupReminder(config.vaultPath, new Date(), showMainWindow)
      })
      .catch(() => {})
  }

  checkBackupReminder()
  setInterval(checkBackupReminder, 60 * 1000)

  if (process.env.WORKRECORD_OPEN_CAPTURE) openCapture()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('second-instance', () => {
  showMainWindow()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  // 常驻托盘：关掉窗口不退出，从托盘菜单或快捷键继续使用
})
