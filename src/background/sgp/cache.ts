// =================================================================
// SGP — CACHE DO FORMULÁRIO
// =================================================================

const sgpFormCache = new Map<string, any>()
const SGP_FORM_CACHE_MAX = 50

export function getSgpFormCache(key: string): any | undefined {
  return sgpFormCache.get(key)
}

export function hasSgpFormCache(key: string): boolean {
  return sgpFormCache.has(key)
}

export function setSgpFormCache(key: string, value: any): void {
  if (sgpFormCache.size >= SGP_FORM_CACHE_MAX) {
    const firstKey = sgpFormCache.keys().next().value as string
    sgpFormCache.delete(firstKey)
  }
  sgpFormCache.set(key, value)
}

export function deleteSgpFormCache(key: string): void {
  sgpFormCache.delete(key)
}
