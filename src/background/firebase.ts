// =================================================================
// FIREBASE — CONFIG, LOGIN E DADOS
// =================================================================

import { initializeApp, FirebaseApp } from 'firebase/app'
import { getDatabase, Database } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyB5wO0x-7NFmh6waMKzWzRew4ezfYOmYBI',
  authDomain: 'site-ati-75d83.firebaseapp.com',
  databaseURL: 'https://site-ati-75d83-default-rtdb.firebaseio.com/',
  projectId: 'site-ati-75d83',
  storageBucket: 'site-ati-75d83.appspot.com',
  messagingSenderId: '467986581951',
  appId: '1:467986581951:web:046a778a0c9b6967d5790a',
}

interface AuthResponseData {
  localId?: string;
  idToken?: string;
  error?: { message: string }
}

interface FirebaseAtendente {
  uid: string
  nomeCompleto: string
  status: string
  role: 'usuario' | 'admin'
  email: string
}

let firebaseApp: FirebaseApp
let firebaseDb: Database

export function getFirebaseApp(): FirebaseApp {
  if (!firebaseApp) firebaseApp = initializeApp(firebaseConfig)
  return firebaseApp
}

export function getFirebaseDb(): Database {
  if (!firebaseDb) firebaseDb = getDatabase(getFirebaseApp())
  return firebaseDb
}

// =================================================================
// LOGIN
// =================================================================

export async function handleFirebaseLogin(email: string, password: string) {
  try {
    console.log('Extensão ATI: Autenticando via REST API...')
    
    // Clear caches on new login attempts
    cachedTemplates = null
    cachedQuickReplies = null

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
    let foundData: FirebaseAtendente | null = null

    for (const [username, data] of Object.entries(atendentes) as [string, FirebaseAtendente][]) {
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
  } catch (error: unknown) {
    console.error('Extensão ATI: Erro no login Firebase.', error)
    return { success: false, error: 'Erro de conexão. Verifique sua internet.' }
  }
}

// =================================================================
// TEMPLATES DE O.S
// =================================================================

import { OsTemplate, SgpOccurrenceType } from '../contentScript/sgp/types'
import { extractOptions } from './sgp/contracts'

// Cache em memória do Service Worker
let cachedTemplates: OsTemplate[] | null = null
let cachedQuickReplies: OsTemplate[] | null = null
let cachedOccurrenceTypes: SgpOccurrenceType[] | null = null

// =================================================================
// TIPOS DE OCORRÊNCIA — Cache em memória + Firebase (1x/dia) + SGP fallback
// =================================================================

export async function getOccurrenceTypes(baseUrl: string, idToken: string): Promise<SgpOccurrenceType[]> {
  // Camada 1: cache em memória (Service Worker ativo)
  if (cachedOccurrenceTypes) {
    console.log(`Extensão ATI: Tipos de ocorrência em memória (${cachedOccurrenceTypes.length} tipos).`)
    return cachedOccurrenceTypes
  }

  const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"

  try {
    // Camada 2: Firebase (agora seguro com auth != null)
    const fbRes = await fetch(
      `${firebaseConfig.databaseURL}sgp_cache.json?auth=${idToken}`,
      { signal: AbortSignal.timeout(5000) }
    )
    const fbData = await fbRes.json() as { updatedAt?: string; occurrenceTypes?: SgpOccurrenceType[] } | null

    if (fbData?.updatedAt === today && Array.isArray(fbData.occurrenceTypes) && fbData.occurrenceTypes.length > 0) {
      // Cache do Firebase válido para hoje — usa direto
      console.log(`Extensão ATI: Tipos de ocorrência do Firebase (${fbData.occurrenceTypes.length} tipos, cache de hoje).`)
      cachedOccurrenceTypes = fbData.occurrenceTypes
      return cachedOccurrenceTypes
    }

    // Camada 3: Cache expirado/ausente — busca do SGP e atualiza Firebase
    console.log('Extensão ATI: Cache de tipos expirado. Sincronizando com o SGP...')
    const sgpRes = await fetch(
      `${baseUrl}/admin/atendimento/cliente/1/ocorrencia/add/`,
      { credentials: 'include', signal: AbortSignal.timeout(10000) },
    )
    const sgpHtml = await sgpRes.text()
    const freshTypes = extractOptions(
      sgpHtml,
      /<select[^>]+id=['"](id_tipo)['"][^>]*>([\.\s\S]*?)<\/select>/,
    )

    if (freshTypes.length > 0) {
      // Atualiza Firebase (agora autorizado usando o idToken do usuário logado)
      fetch(
        `${firebaseConfig.databaseURL}sgp_cache.json?auth=${idToken}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updatedAt: today, occurrenceTypes: freshTypes }),
          signal: AbortSignal.timeout(5000),
        },
      ).then(() => {
        console.log(`Extensão ATI: Firebase sgp_cache atualizado com ${freshTypes.length} tipos.`)
      }).catch((writeErr) => {
        console.warn('Extensão ATI: Falha ao atualizar sgp_cache no Firebase.', writeErr)
      })

      cachedOccurrenceTypes = freshTypes
      return cachedOccurrenceTypes
    }

    // SGP também falhou — retorna o que havia no Firebase mesmo expirado
    if (Array.isArray(fbData?.occurrenceTypes) && fbData!.occurrenceTypes!.length > 0) {
      console.warn('Extensão ATI: SGP falhou. Usando tipos desatualizados do Firebase.')
      cachedOccurrenceTypes = fbData!.occurrenceTypes!
      return cachedOccurrenceTypes
    }

    return []
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar tipos de ocorrência.', error)
    return cachedOccurrenceTypes ?? []
  }
}

export async function getOsTemplates(username: string, idToken: string): Promise<OsTemplate[]> {
  if (cachedTemplates) {
    console.log(`Extensão ATI: Retornando ${cachedTemplates.length} templates do cache em memória.`)
    return cachedTemplates
  }
  try {
    const res = await fetch(
      `${firebaseConfig.databaseURL}modelos_os/${username}.json?auth=${idToken}`,
    )
    const data = await res.json()
    const templates = data ? (Object.values(data) as OsTemplate[]) : []
    
    cachedTemplates = templates
    console.log(`Extensão ATI: ${templates.length} templates carregados para ${username}`)
    return templates
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar templates.', error)
    return []
  }
}

// =================================================================
// QUICK REPLIES
// =================================================================

export async function getQuickReplies(username: string): Promise<OsTemplate[]> {
  if (cachedQuickReplies) {
    console.log(`Extensão ATI: Retornando ${cachedQuickReplies.length} quick replies do cache em memória.`)
    return cachedQuickReplies
  }

  try {
    const [userRes, masterRes] = await Promise.all([
      fetch(`${firebaseConfig.databaseURL}respostas/${username}.json`),
      fetch(`${firebaseConfig.databaseURL}respostas/master.json`),
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
      (r: OsTemplate) => r?.category === 'quick_reply' && r?.text && r?.title,
    )

    cachedQuickReplies = all
    console.log(`Extensão ATI: ${all.length} quick replies carregados para ${username}`)
    return all
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar quick replies.', error)
    return []
  }
}
