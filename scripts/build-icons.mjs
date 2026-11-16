import { mkdir, readFile } from 'node:fs/promises'
import sharp from 'sharp'

await mkdir('resources', { recursive: true })

const icon = await readFile('build/icon.svg')
await sharp(icon).png().toFile('resources/icon.png')

const tray = await readFile('build/tray.svg')
await sharp(tray).png().toFile('resources/tray.png')

console.log('icons written to resources/')
