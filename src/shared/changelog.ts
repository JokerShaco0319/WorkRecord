import changelog from './changelog.json'
import { compareVersions } from './update'

export interface ReleaseNote {
  version: string
  date: string
  notes: string
}

export const APP_CHANGELOG: ReleaseNote[] = changelog.releases

export function notesBetween(from: string, to: string): ReleaseNote[] {
  return APP_CHANGELOG.filter(
    (release) =>
      compareVersions(release.version, from) > 0 && compareVersions(release.version, to) <= 0
  ).sort((a, b) => compareVersions(a.version, b.version))
}
