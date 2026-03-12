// =================================================================
// SESSÃO — Salva e recupera dados do usuário logado
// =================================================================

export interface UserSession {
  uid: string
  username: string
  nomeCompleto: string
  role: 'admin' | 'usuario'
  email: string
  idToken: string // ← adiciona isso
}

const SESSION_KEY = 'ati_user_session'

export async function getSession(): Promise<UserSession | null> {
  try {
    const result = await chrome.storage.local.get(SESSION_KEY)
    return result[SESSION_KEY] ?? null
  } catch (error) {
    console.error('Extensão ATI: Erro ao ler sessão.', error)
    return null
  }
}

export async function saveSession(session: UserSession): Promise<void> {
  try {
    await chrome.storage.local.set({ [SESSION_KEY]: session })
    console.log(`Extensão ATI: Sessão salva para ${session.username}`)
  } catch (error) {
    console.error('Extensão ATI: Erro ao salvar sessão.', error)
  }
}

export async function clearSession(): Promise<void> {
  try {
    await chrome.storage.local.remove(SESSION_KEY)
    console.log('Extensão ATI: Sessão encerrada.')
  } catch (error) {
    console.error('Extensão ATI: Erro ao limpar sessão.', error)
  }
}

export async function isLoggedIn(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}
