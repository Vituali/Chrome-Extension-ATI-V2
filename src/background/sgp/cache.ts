// =================================================================
// SGP — CACHE DO FORMULÁRIO
// =================================================================

import { SgpData } from '../../contentScript/sgp/types'

const sgpFormCache = new Map<string, SgpData>()
const SGP_FORM_CACHE_MAX = 50

export function getSgpFormCache(key: string): SgpData | undefined {
  return sgpFormCache.get(key)
}

export function hasSgpFormCache(key: string): boolean {
  return sgpFormCache.has(key)
}

export function setSgpFormCache(key: string, value: SgpData): void {
  if (sgpFormCache.size >= SGP_FORM_CACHE_MAX) {
    const firstKey = sgpFormCache.keys().next().value as string
    sgpFormCache.delete(firstKey)
  }
  sgpFormCache.set(key, value)
}

export function deleteSgpFormCache(key: string): void {
  sgpFormCache.delete(key)
}
