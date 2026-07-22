/** Dot-segment version compare (legacy appVersionComparisonService). */
export function compareAppVersions(v1?: string | null, v2?: string | null): number {
  const index = (versionText?: string | null): string => {
    if (versionText == null || versionText.trim().length === 0) {
      return '-1000000'
    }
    let result = ''
    const parts = versionText.split('.')
    for (const partRaw of parts) {
      let part = partRaw.replace(/[^0-9]+/g, '')
      if (part.trim().length === 0) {
        part = '0'
      }
      while (part.length < 10) {
        part = `0${part}`
      }
      result += part
    }
    return result
  }

  const i1 = index(v1)
  const i2 = index(v2)
  if (i1 === i2) {
    return 0
  }
  return i1 < i2 ? -1 : 1
}
