// =================================================================
// ENTRY POINT — CHATMIX CONTENT SCRIPT
// =================================================================

import './style.css'
import { SELECTORS, log, logError, currentChatId, setCurrentChatId } from './state'
import { getClientData } from './getClientData'
import { formatPhoneNumber } from './helpers'
import { setCachedContract, smartOpenSGP } from '../sgp/actions'
import { getSession, UserSession } from './auth/session'
import { showOSModal } from './os/osModal'
import { collectTextFromMessages } from './helpers'
import { injectLoginBanner } from './auth/loginModal'
import { injectQuickReply, injectQuickReplyLoading, removeQuickReply } from './Quickreply'
// Sessão atual em memória
let currentSession: UserSession | null = null

// =================================================================
// INJEÇÃO DOS BOTÕES
// =================================================================

function injectButtons(): void {
  if (document.getElementById('actionsContainerV2')) return

  const sidebar = document.querySelector(SELECTORS.sidebar)
  if (!sidebar) return

  const container = document.createElement('div')
  container.id = 'actionsContainerV2'
  container.innerHTML = `
    <button class="action-btn" id="ati-copy-contact">👤 Contato</button>
    <button class="action-btn" id="ati-copy-prompt">🤖 Chat</button>
    <button class="action-btn" id="ati-copy-cpf">📄 CPF</button>
    <button class="action-btn" id="ati-open-os">📝 O.S</button>
    <button class="action-btn" id="ati-refresh">🔄 Atualizar</button>
    <button class="action-btn" id="ati-open-sgp">↗️ SGP</button>
  `

  sidebar.appendChild(container)
  log('Botões injetados na sidebar.')
}

// =================================================================
// FEEDBACK VISUAL DOS BOTÕES
// =================================================================

async function execAction(btn: HTMLButtonElement, action: () => Promise<void>): Promise<void> {
  const originalText = btn.innerHTML
  btn.innerHTML = `<span class="spinner"></span>`
  btn.disabled = true

  try {
    await action()
    btn.innerHTML = '✅'
    btn.classList.add('action-btn--success')
  } catch (error) {
    logError('Erro na ação do botão:', error)
    btn.innerHTML = '❌'
    btn.classList.add('action-btn--error')
  } finally {
    await new Promise((r) => setTimeout(r, 1200))
    btn.innerHTML = originalText
    btn.classList.remove('action-btn--success', 'action-btn--error')
    btn.disabled = false
  }
}

// =================================================================
// AÇÕES DOS BOTÕES
// =================================================================

const actions: Record<string, () => Promise<void>> = {
  'ati-copy-contact': async () => {
    const data = await getClientData()
    const text = `${formatPhoneNumber(data.phoneNumber)} ${data.firstName} |`.trim()
    await navigator.clipboard.writeText(text)
    log(`Contato copiado: ${text}`)
  },

  'ati-copy-prompt': async () => {
    const btn = document.querySelector<HTMLButtonElement>(SELECTORS.copyChatBtn)
    if (!btn) throw new Error('Botão de cópia do chat não encontrado.')
    btn.click()
    log('Chat copiado via botão nativo do ChatMix.')
  },

  'ati-copy-cpf': async () => {
    const data = await getClientData()
    if (!data.cpfCnpj) throw new Error('CPF/CNPJ não encontrado nas mensagens.')
    await navigator.clipboard.writeText(data.cpfCnpj)
    log(`CPF copiado: ${data.cpfCnpj}`)
  },

  'ati-open-os': async () => {
    const data = await getClientData()
    log(`OS check — isIdentified: ${data.isIdentified}, phone: ${data.phoneNumber}, cpf: ${data.cpfCnpj}`)
    
    if (!data.isIdentified && !data.phoneNumber && !data.cpfCnpj) {
      throw new Error('Sem dados do cliente para abrir O.S.')
    }
    const session = await getSession()
    if (!session) throw new Error('Usuário não logado.')

    // Busca templates do Firebase (modelos_os do atendente)
    const response = await Promise.race([
      chrome.runtime.sendMessage({
        action: 'getOsTemplates',
        username: session.username,
        idToken: session.idToken,
      }),
    ])
    const templates = response?.templates ?? []

    await showOSModal(templates, () => collectTextFromMessages(), data)
  },

  'ati-refresh': async () => {
    setCachedContract(null)
    const data = await getClientData()
    log('Dados atualizados:', data)
  },

  'ati-open-sgp': async () => {
    const data = await getClientData()
    if (!data.isIdentified && !data.cpfCnpj && !data.phoneNumber) {
      chrome.runtime.sendMessage({ action: 'openInSgp', clientData: data, cachedContract: null })
      return
    }
    await smartOpenSGP(data)
  },
}

// =================================================================
// LISTENERS
// =================================================================

function injectListeners(): void {
  Object.entries(actions).forEach(([id, action]) => {
    const btn = document.getElementById(id) as HTMLButtonElement | null
    if (!btn) {
      logError(`Botão não encontrado para listener: ${id}`)
      return
    }
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      await execAction(e.currentTarget as HTMLButtonElement, action)
    })
  })
  log('Listeners injetados.')
}

// =================================================================
// CONTROLE DE TROCA DE ATENDIMENTO
// =================================================================

function checkSessionChange(): void {
  const matches = window.location.href.match(/\/(\d+)$/)
  const newChatId = matches ? matches[1] : null

  if (newChatId && newChatId !== currentChatId) {
    log(`Atendimento trocado: ${currentChatId} → ${newChatId}`)
    setCurrentChatId(newChatId)
    setCachedContract(null)
  }
}

// =================================================================
// INIT COM VERIFICAÇÃO DE LOGIN
// =================================================================

async function init(): Promise<void> {
  const sidebar = document.querySelector(SELECTORS.sidebar)
  if (!sidebar) return

  checkSessionChange()

  const session = await getSession()

  if (!session) {
    log('Usuário não logado — exibindo banner de login.')
    injectLoginBanner((newSession) => {
      currentSession = newSession
      log(`Login realizado: ${newSession.username} (${newSession.role})`)
      injectButtons()
      injectListeners()
    })
    return
  }

  currentSession = session
  log(`Sessão ativa: ${session.username} (${session.role})`)
  injectButtons()
  injectListeners()
  loadQuickReplies(session)
}

// =================================================================
// QUICK REPLY — Carrega e injeta
// =================================================================

async function loadQuickReplies(session: UserSession, attempt = 0): Promise<void> {
  const textarea = document.querySelector(SELECTORS.textarea)
  
  if (!textarea) {
    if (attempt < 10) {
      // Tenta novamente em 500ms por até 5 segundos
      setTimeout(() => loadQuickReplies(session, attempt + 1), 500)
    } else {
      log('Textarea não encontrado após 10 tentativas.')
    }
    return
  }

  injectQuickReplyLoading()
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getQuickReplies',
      username: session.username,
    })
    const replies = response?.replies ?? []
    injectQuickReply(replies)
  } catch (error) {
    logError('Erro ao carregar quick replies:', error)
    removeQuickReply()
  }
}

// =================================================================
// OBSERVER
// =================================================================

const observer = new MutationObserver(() => {
  const sidebar = document.querySelector(SELECTORS.sidebar)
  const hasButtons = document.getElementById('actionsContainerV2')
  const hasBanner = document.getElementById('ati-login-banner')
  const hasQuickReply = document.getElementById('ati-quick-reply-container')
  const hasTextarea = document.querySelector(SELECTORS.textarea)

  checkSessionChange()

  if (sidebar && !hasButtons && !hasBanner) {
    log('Sidebar sem conteúdo, reinjetando...')
    init()
    return
  }

  // Reinjetar quick reply se textarea existe mas container sumiu
  if (hasTextarea && !hasQuickReply && currentSession) {
    log('Quick reply sumiu, reinjetando...')
    loadQuickReplies(currentSession)
  }
})

observer.observe(document.body, { childList: true, subtree: true })
init()