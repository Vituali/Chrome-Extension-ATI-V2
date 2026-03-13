// =================================================================
// SGP — AUTENTICAÇÃO
// =================================================================

import { SGP_DNS, SGP_IP, LOGIN_CACHE_TTL_MS } from './constants'

export async function performLoginCheck(
  baseUrl: string,
): Promise<{ isLoggedIn: boolean; baseUrl: string }> {
  try {
    const response = await fetch(`${baseUrl}/admin/`, {
      credentials: 'include',
      signal: AbortSignal.timeout(4000),
    })
    const isLoggedIn = !response.url.includes('/accounts/login')
    console.log(`Extensão ATI: Login check em ${baseUrl} — logado: ${isLoggedIn}`)
    return { isLoggedIn, baseUrl }
  } catch (error) {
    console.error(`Extensão ATI: Falha ao verificar login em ${baseUrl}.`, error)
    throw error
  }
}

async function checkSgpStatus(): Promise<{ isLoggedIn: boolean; baseUrl: string }> {
  console.log('Extensão ATI: Verificando status do SGP...')

  try {
    const dns = await performLoginCheck(SGP_DNS)
    if (dns.isLoggedIn) return dns
  } catch {
    console.warn('Extensão ATI: DNS falhou, tentando IP direto...')
  }

  try {
    const ip = await performLoginCheck(SGP_IP)
    if (ip.isLoggedIn) return ip
  } catch {
    console.error('Extensão ATI: IP direto também falhou.')
  }

  return { isLoggedIn: false, baseUrl: SGP_DNS }
}

export async function getSgpStatus(): Promise<{ isLoggedIn: boolean; baseUrl: string }> {
  const result = await chrome.storage.local.get('sgp_status_cache')
  const cache = result.sgp_status_cache

  if (cache?.isLoggedIn) {
    const isExpired = Date.now() - cache.timestamp > LOGIN_CACHE_TTL_MS
    if (!isExpired) {
      try {
        const verified = await performLoginCheck(cache.baseUrl)
        if (verified.isLoggedIn) {
          console.log('Extensão ATI: Sessão SGP ainda ativa (cache).')
          return verified
        }
      } catch {
        console.warn('Extensão ATI: Sessão SGP do cache inválida, renovando...')
      }
    } else {
      console.log('Extensão ATI: Cache SGP expirado, renovando...')
    }
    await chrome.storage.local.remove('sgp_status_cache')
  }

  const status = await checkSgpStatus()
  await chrome.storage.local.set({ sgp_status_cache: { ...status, timestamp: Date.now() } })
  return status
}
