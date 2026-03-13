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
// TEMPLATES DE O.S
// =================================================================

export async function getOsTemplates(username: string, idToken: string): Promise<any[]> {
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
// QUICK REPLIES
// =================================================================

export async function getQuickReplies(username: string): Promise<any[]> {
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
      (r: any) => r?.category === 'quick_reply' && r?.text && r?.title,
    )

    console.log(`Extensão ATI: ${all.length} quick replies carregados para ${username}`)
    return all
  } catch (error) {
    console.error('Extensão ATI: Erro ao buscar quick replies.', error)
    return []
  }
}
