// =================================================================
// BACKGROUND SERVICE WORKER
// Toda lógica que precisa de fetch (CORS) ou chrome.tabs fica aqui
// Firebase Auth também fica aqui para evitar bloqueio de referer
// =================================================================

import { initializeApp, FirebaseApp } from 'firebase/app'
import { getDatabase, ref, get, Database } from 'firebase/database'

console.log('Extensão ATI: Background iniciado.')

// =================================================================
// FIREBASE
// =================================================================

const firebaseConfig = {
  apiKey: 'AIzaSyB5wO0x-7NFmh6waMKzWzRew4ezfYOmYBI',
  authDomain: 'site-ati-75d83.firebaseapp.com',
  databaseURL: 'https://site-ati-75d83-default-rtdb.firebaseio.com/',
  projectId: 'site-ati-75d83',
  storageBucket: 'site-ati-75d83.appspot.com',
  messagingSenderId: '467986581951',
  appId: '1:467986581951:web:046a778a0c9b6967d5790a',
}

let firebaseApp: FirebaseApp
let firebaseDb: Database

function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) firebaseApp = initializeApp(firebaseConfig)
  return firebaseApp
}

function getFirebaseDb(): Database {
  if (!firebaseDb) firebaseDb = getDatabase(getFirebaseApp())
  return firebaseDb
}

// =================================================================
// SGP
// =================================================================

const SGP_DNS = 'https://sgp.atiinternet.com.br'
const SGP_IP = 'http://201.158.20.35:8000'
const LOGIN_CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 horas

interface ClientData {
  fullName: string
  firstName: string
  phoneNumber: string
  cpfCnpj: string | null
  isIdentified: boolean
}

interface SgpClient {
  id: string
  text: string
}

// =================================================================
// LISTENER DE MENSAGENS
// =================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'firebaseLogin') {
    handleFirebaseLogin(request.email, request.password)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'openInSgp') {
    handleOpenInSgp(request.clientData, request.cachedContract)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'getSgpFormParams') {
    getSgpFormParams(request.clientData)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, message: error.message }))
    return true
  }

  if (request.action === 'createOccurrenceVisually') {
    createOccurrenceVisually(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'clearSgpCache') {
    const key = request.cacheKey
    sgpFormCache.delete(key)
    sendResponse({ success: true })
    return true
  }

  if (request.action === 'getOsTemplates') {
    getOsTemplates(request.username, request.idToken)
      .then((templates) => sendResponse({ success: true, templates }))
      .catch((error) => sendResponse({ success: false, templates: [], error: error.message }))
    return true
  }
  if (request.action === 'getQuickReplies') {
    getQuickReplies(request.username)
      .then((replies) => sendResponse({ success: true, replies }))
      .catch((error) => sendResponse({ success: false, replies: [], error: error.message }))
    return true
  }
})

// =================================================================
// FIREBASE LOGIN
// =================================================================

async function handleFirebaseLogin(email: string, password: string) {
  try {
    console.log('Extensão ATI: Autenticando via REST API...')

    const authResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
        signal: AbortSignal.timeout(8000),
      },
    )

    console.log('Extensão ATI: Auth response status:', authResponse.status)
    const authData = await authResponse.json()
    console.log('Extensão ATI: Auth data:', JSON.stringify(authData).slice(0, 200))

    if (!authResponse.ok) {
      const errorMessages: Record<string, string> = {
        EMAIL_NOT_FOUND: 'Email não encontrado.',
        INVALID_PASSWORD: 'Senha incorreta.',
        INVALID_LOGIN_CREDENTIALS: 'Email ou senha incorretos.',
        TOO_MANY_ATTEMPTS_TRY_LATER: 'Muitas tentativas. Tente mais tarde.',
        USER_DISABLED: 'Seu acesso está bloqueado. Fale com o administrador.',
      }
      const code = authData?.error?.message ?? ''
      return { success: false, error: errorMessages[code] ?? 'Erro ao fazer login.' }
    }

    const uid = authData.localId
    const idToken = authData.idToken

    const dbResponse = await fetch(`${firebaseConfig.databaseURL}atendentes.json?auth=${idToken}`)
    const atendentes = await dbResponse.json()

    if (!atendentes) {
      return { success: false, error: 'Nenhum atendente cadastrado no sistema.' }
    }

    let foundUsername: string | null = null
    let foundData: any = null

    for (const [username, data] of Object.entries(atendentes) as any) {
      if (data.uid === uid) {
        foundUsername = username
        foundData = data
        break
      }
    }

    if (!foundUsername || !foundData) {
      return { success: false, error: 'Usuário não encontrado. Fale com o administrador.' }
    }

    if (foundData.status && foundData.status !== 'ativo') {
      return { success: false, error: 'Seu acesso está bloqueado. Fale com o administrador.' }
    }

    const session = {
      uid,
      username: foundUsername,
      nomeCompleto: foundData.nomeCompleto,
      role: foundData.role,
      email: foundData.email,
      idToken,
    }

    console.log(`Extensão ATI: Login realizado — ${foundUsername} (${foundData.role})`)
    return { success: true, session }
  } catch (error: any) {
    console.error('Extensão ATI: Erro no login Firebase.', error)
    return { success: false, error: 'Erro de conexão. Verifique sua internet.' }
  }
}

// =================================================================
// SGP — AUTENTICAÇÃO
// =================================================================

async function performLoginCheck(
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

async function getSgpStatus(): Promise<{ isLoggedIn: boolean; baseUrl: string }> {
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

// =================================================================
// SGP — BUSCA DE CLIENTE
// =================================================================

async function executeSearch(url: string): Promise<SgpClient[] | null> {
  try {
    const response = await fetch(url, { credentials: 'include' })
    const data: SgpClient[] = await response.json()
    console.log(`Extensão ATI: Busca retornou ${data?.length ?? 0} resultado(s) — ${url}`)
    return data?.length > 0 ? data : null
  } catch (error) {
    console.error(`Extensão ATI: Erro na busca — ${url}`, error)
    return null
  }
}

async function findClientInSgp(
  baseUrl: string,
  clientData: ClientData,
): Promise<SgpClient[] | null> {
  const { cpfCnpj, fullName, phoneNumber } = clientData
  const base = `${baseUrl}/public/autocomplete/ClienteAutocomplete`

  if (cpfCnpj) {
    console.log('Extensão ATI: Buscando por CPF/CNPJ...')
    const result = await executeSearch(`${base}?tconsulta=cpfcnpj&term=${cpfCnpj}`)
    if (result) return result
  }

  if (fullName && fullName !== 'Cliente') {
    console.log('Extensão ATI: Buscando por nome...')
    const result = await executeSearch(
      `${base}?tconsulta=nome&term=${encodeURIComponent(fullName)}`,
    )
    if (result) return result
  }

  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, '').replace(/^55/, '').substring(0, 11)
    console.log(`Extensão ATI: Buscando por telefone — ${cleanPhone}`)
    const result = await executeSearch(`${base}?tconsulta=telefone&term=${cleanPhone}`)
    if (result) return result
  }

  console.warn('Extensão ATI: Cliente não encontrado por nenhum critério.')
  return null
}

// =================================================================
// SGP — ABERTURA DE ABAS
// =================================================================

async function focusOrOpenTab(url: string, clientId?: string): Promise<void> {
  if (clientId) {
    const existing = await chrome.tabs.query({ url: 'https://sgp.atiinternet.com.br/admin/*' })
    const match = existing.find((tab) => tab.url?.includes(`/${clientId}/`))

    if (match) {
      console.log(`Extensão ATI: Focando aba existente do cliente ${clientId}`)
      await chrome.tabs.update(match.id!, { active: true })
      await chrome.windows.update(match.windowId, { focused: true })
      return
    }
  }

  console.log(`Extensão ATI: Abrindo nova aba — ${url}`)
  await chrome.tabs.create({ url })
}

// =================================================================
// SGP — HANDLER PRINCIPAL
// =================================================================

async function handleOpenInSgp(
  clientData: ClientData,
  cachedContract: string | null,
): Promise<void> {
  if (cachedContract) {
    console.log(`Extensão ATI: Usando contrato cacheado — ${cachedContract}`)
    const url = `${SGP_DNS}/admin/clientecontrato/${cachedContract}/change/`
    await focusOrOpenTab(url, cachedContract)
    return
  }

  const { isLoggedIn, baseUrl } = await getSgpStatus()

  if (!isLoggedIn) {
    console.warn('Extensão ATI: Não logado no SGP, abrindo login...')
    await focusOrOpenTab(`${baseUrl}/accounts/login/`)
    return
  }

  const hasData =
    clientData.cpfCnpj ||
    (clientData.fullName && clientData.fullName !== 'Cliente') ||
    clientData.phoneNumber

  if (!hasData) {
    console.warn('Extensão ATI: Sem dados do cliente, abrindo admin como fallback.')
    await focusOrOpenTab(`${baseUrl}/admin/`)
    return
  }

  const clients = await findClientInSgp(baseUrl, clientData)

  if (clients && clients.length > 0) {
    const client = clients[0]
    console.log(`Extensão ATI: Cliente encontrado — ID ${client.id}`)
    await focusOrOpenTab(`${baseUrl}/admin/cliente/${client.id}/contratos/`, client.id)
  } else {
    console.warn('Extensão ATI: Cliente não encontrado, abrindo admin geral.')
    await focusOrOpenTab(`${baseUrl}/admin/`)
  }
}

// =================================================================
// SGP — FORMULÁRIO DE OCORRÊNCIA (getSgpFormParams)
// =================================================================

const sgpFormCache = new Map<string, any>()

async function getSgpFormParams(clientData: ClientData): Promise<any> {
  const { isLoggedIn, baseUrl } = await getSgpStatus()
  if (!isLoggedIn) throw new Error('Não está logado no SGP.')

  // Primeiro encontra o(s) cliente(s) no SGP
  const clients = await findClientInSgp(baseUrl, clientData)
  if (!clients || clients.length === 0) throw new Error('Cliente não encontrado no SGP.')

  const cacheKey = clientData.cpfCnpj ?? clientData.fullName ?? clientData.phoneNumber ?? 'unknown'

  if (sgpFormCache.has(cacheKey)) {
    console.log(`Extensão ATI: Usando cache do formulário SGP para ${cacheKey}`)
    return sgpFormCache.get(cacheKey)
  }

  console.log(`Extensão ATI: Buscando dados do formulário para ${clients.length} cliente(s).`)

  let allContracts: any[] = []
  let responsibleUsers: any[] = []
  let occurrenceTypes: any[] = []

  const extractOptions = (html: string, selectIdRegex: RegExp) => {
    const match = html.match(selectIdRegex)
    const options: { id: string; text: string }[] = []
    if (match?.[1]) {
      const optionRegex = /<option[^>]+value=['"](\d+)['"][^>]*>([\s\S]*?)<\/option>/g
      let m
      while ((m = optionRegex.exec(match[1])) !== null) {
        if (m[1]) options.push({ id: m[1], text: m[2].trim().replace(/&nbsp;/g, ' ') })
      }
    }
    return options
  }

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const url = `${baseUrl}/admin/atendimento/cliente/${client.id}/ocorrencia/add/`

    try {
      const response = await fetch(url, { credentials: 'include' })
      const html = await response.text()

      if (html.includes('id_username') && html.includes('id_password')) {
        await chrome.storage.local.remove('sgp_status_cache')
        throw new Error('Sua sessão no SGP expirou. Faça o login novamente.')
      }

      const initialContracts = extractOptions(
        html,
        /<select[^>]+id=['"]id_clientecontrato['"][^>]*>([\s\S]*?)<\/select>/,
      )

      const mappedContracts = initialContracts.map((c) => ({
        ...c,
        clientId: client.id,
        text: clients.length > 1 ? `[Cadastro ${client.id}] ${c.text}` : c.text,
      }))

      // Busca endereço de cada contrato
      const contractsWithAddress = await Promise.all(
        mappedContracts.map(async (contract) => {
          try {
            const servRes = await fetch(
              `${baseUrl}/admin/clientecontrato/servico/list/ajax/?contrato_id=${contract.id}`,
              { credentials: 'include' },
            )
            const services = await servRes.json()
            if (services?.length > 0 && services[0].id) {
              const detailRes = await fetch(
                `${baseUrl}/admin/atendimento/ocorrencia/servico/detalhe/ajax/?servico_id=${services[0].id}&contrato_id=${contract.id}`,
                { credentials: 'include' },
              )
              const details = await detailRes.json()
              if (details?.length > 0 && details[0]?.end_instalacao) {
                return { ...contract, text: `${contract.text} - ${details[0].end_instalacao}` }
              }
            }
          } catch {
            console.warn(`Extensão ATI: Sem endereço para contrato ${contract.id}.`)
          }
          return contract
        }),
      )

      allContracts = allContracts.concat(contractsWithAddress)

      // Captura tipos e responsáveis só do primeiro cliente
      if (i === 0) {
        responsibleUsers = extractOptions(
          html,
          /<select[^>]+id=['"]id_responsavel['"][^>]*>([\s\S]*?)<\/select>/,
        ).map((u) => ({ id: u.id, username: u.text.toLowerCase() }))
        occurrenceTypes = extractOptions(
          html,
          /<select[^>]+id=['"]id_tipo['"][^>]*>([\s\S]*?)<\/select>/,
        )
      }
    } catch (error) {
      console.error(`Extensão ATI: Falha ao buscar dados para cliente ${client.id}.`, error)
      throw error
    }
  }

  if (allContracts.length === 0) throw new Error('Nenhum contrato encontrado.')

  const result = {
    clientSgpId: clients[0].id,
    contracts: allContracts,
    responsibleUsers,
    occurrenceTypes,
  }

  const SGP_FORM_CACHE_MAX = 50

  function setSgpFormCache(key: string, value: any): void {
    if (sgpFormCache.size >= SGP_FORM_CACHE_MAX) {
      const firstKey = sgpFormCache.keys().next().value as string
      sgpFormCache.delete(firstKey)
    }
    sgpFormCache.set(key, value)
  }
  setSgpFormCache(cacheKey, result)
  return result
}

// =================================================================
// SGP — CRIAR OCORRÊNCIA VISUALMENTE
// =================================================================

async function createOccurrenceVisually(data: any): Promise<void> {
  const { isLoggedIn, baseUrl } = await getSgpStatus()
  if (!isLoggedIn) throw new Error('Não está logado no SGP.')

  const url = `${baseUrl}/admin/atendimento/cliente/${data.clientSgpId}/ocorrencia/add/`
  await chrome.storage.local.set({ pendingSgpData: data })
  await chrome.tabs.create({ url, active: true })
}

// =================================================================
// FIREBASE — BUSCA TEMPLATES DE O.S DO ATENDENTE
// =================================================================

async function getOsTemplates(username: string, idToken: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${firebaseConfig.databaseURL}modelos_os/${username}.json?auth=${idToken}`,
    )
    const data = await res.json()
    const templates = data ? Object.values(data) : []
    console.log(`Extensão ATI: ${templates.length} templates carregados para ${username}`)
    return templates
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar templates.', error)
    return []
  }
}

// =================================================================
// FIREBASE — BUSCA QUICK REPLIES DO ATENDENTE
// =================================================================

async function getQuickReplies(username: string): Promise<any[]> {
  try {
    const [userRes, masterRes] = await Promise.all([
      fetch(`${firebaseConfig.databaseURL}respostas/${username}.json`),
      fetch(`${firebaseConfig.databaseURL}respostas/master.json`), // se existir
    ])

    const userData = await userRes.json()
    const masterData = masterRes.ok ? await masterRes.json() : null

    const userReplies = Array.isArray(userData) ? userData : Object.values(userData ?? {})

    const masterReplies = masterData
      ? Array.isArray(masterData)
        ? masterData
        : Object.values(masterData)
      : []

    const all = [...masterReplies, ...userReplies].filter(
      (r: any) => r?.category === 'quick_reply' && r?.text && r?.title,
    )

    console.log(`Extensão ATI: ${all.length} quick replies carregados para ${username}`)
    return all
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar quick replies.', error)
    return []
  }
}
