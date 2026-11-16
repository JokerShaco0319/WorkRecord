import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Asset } from '@shared/api'
import { decryptJson, encryptJson, type EncryptedPayload } from './crypto'
import { projectDirPath } from './projects'
import { requireKey } from './security'

interface AssetsFile {
  items: Asset[]
}

export function assetsPath(vaultPath: string, project: string): string {
  return join(projectDirPath(vaultPath, project), '.vault', 'assets.enc')
}

export async function listAssets(vaultPath: string, project: string): Promise<Asset[]> {
  const key = requireKey(vaultPath)

  let raw: string
  try {
    raw = await readFile(assetsPath(vaultPath, project), 'utf-8')
  } catch {
    return []
  }

  const payload = JSON.parse(raw) as EncryptedPayload
  return decryptJson<AssetsFile>(key, payload).items ?? []
}

async function writeAssets(vaultPath: string, project: string, items: Asset[]): Promise<void> {
  const key = requireKey(vaultPath)
  const dir = join(projectDirPath(vaultPath, project), '.vault')
  await mkdir(dir, { recursive: true })
  await writeFile(
    join(dir, 'assets.enc'),
    JSON.stringify(encryptJson(key, { items }), null, 2),
    'utf-8'
  )
}

export async function saveAsset(
  vaultPath: string,
  project: string,
  asset: Asset
): Promise<Asset[]> {
  const items = await listAssets(vaultPath, project)
  const normalized: Asset = {
    ...asset,
    id: asset.id || randomUUID(),
    updatedAt: new Date().toISOString(),
    fields: asset.fields.map((field) => ({ ...field, id: field.id || randomUUID() }))
  }

  const index = items.findIndex((item) => item.id === normalized.id)
  if (index >= 0) items[index] = normalized
  else items.push(normalized)

  await writeAssets(vaultPath, project, items)
  return items
}

export async function removeAsset(
  vaultPath: string,
  project: string,
  id: string
): Promise<Asset[]> {
  const items = (await listAssets(vaultPath, project)).filter((item) => item.id !== id)
  await writeAssets(vaultPath, project, items)
  return items
}
