import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let captureWindow: BrowserWindow | null = null

export function closeCapture(): void {
  // 只隐藏不销毁，下次呼出可以立刻显示
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.hide()
}

export function resizeCapture(height: number): void {
  if (!captureWindow || captureWindow.isDestroyed()) return

  const bounds = captureWindow.getBounds()
  captureWindow.setBounds({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: Math.max(148, Math.min(420, Math.round(height)))
  })
}

export function openCapture(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show()
    captureWindow.focus()
    captureWindow.webContents.send('capture:reset')
    return
  }

  captureWindow = new BrowserWindow({
    width: 560,
    height: 148,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    backgroundColor: '#f7f6f3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (!process.env.WORKRECORD_CAPTURE_SHOT) {
    captureWindow.on('blur', () => captureWindow?.hide())
  }
  captureWindow.on('closed', () => {
    captureWindow = null
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void captureWindow.loadURL(`${devUrl}/capture.html`)
  } else {
    void captureWindow.loadFile(join(__dirname, '../renderer/capture.html'))
  }

  captureWindow.once('ready-to-show', () => {
    captureWindow?.show()
    captureWindow?.focus()
  })

  // 仅用于自动化截图验证
  const shot = process.env.WORKRECORD_CAPTURE_SHOT
  if (shot) {
    captureWindow.webContents.once('did-finish-load', async () => {
      captureWindow?.show()
      await new Promise((resolve) => setTimeout(resolve, 800))

      const inputText = process.env.WORKRECORD_CAPTURE_SHOT_INPUT
      if (inputText) {
        const pressEnter = process.env.WORKRECORD_CAPTURE_SHOT_ENTER
          ? "input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))"
          : ''
        await captureWindow?.webContents.executeJavaScript(`(() => {
          const input = document.querySelector('input')
          if (!input) return
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(input, ${JSON.stringify(inputText)})
          input.dispatchEvent(new Event('input', { bubbles: true }))
          ${pressEnter}
        })()`)
        await new Promise((resolve) => setTimeout(resolve, 900))
        if (captureWindow && !captureWindow.isDestroyed()) {
          const image = await captureWindow.webContents.capturePage().catch(() => null)
          if (image) await writeFile(shot, image.toPNG())
        }
        app.quit()
        return
      }

      const image = await captureWindow?.webContents.capturePage()
      if (image) await writeFile(shot, image.toPNG())
      app.quit()
    })
  }
}
