import { app, BrowserWindow } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

let captureWindow: BrowserWindow | null = null

export function closeCapture(): void {
  if (captureWindow && !captureWindow.isDestroyed()) captureWindow.close()
}

export function openCapture(): void {
  if (captureWindow && !captureWindow.isDestroyed()) {
    captureWindow.show()
    captureWindow.focus()
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
    captureWindow.on('blur', () => captureWindow?.close())
  }
  captureWindow.on('closed', () => {
    captureWindow = null
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void captureWindow.loadURL(`${devUrl}#capture`)
  } else {
    void captureWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'capture' })
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
        await captureWindow?.webContents.executeJavaScript(`(() => {
          const input = document.querySelector('input')
          if (!input) return
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
          setter.call(input, ${JSON.stringify(inputText)})
          input.dispatchEvent(new Event('input', { bubbles: true }))
          input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
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
