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
import {
  injectQuickReply,
  injectQuickReplyLoading,
  removeQuickReply,
  getCachedReplies,
  setCachedReplies,
  clearQuickReplyCache,
} from './Quickreply'
import { clearDraft } from './os/osDraft'
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
    log(
      `OS check — isIdentified: ${data.isIdentified}, phone: ${data.phoneNumber}, cpf: ${data.cpfCnpj}`,
    )

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
  watchEncerrarAtendimento()
  loadQuickReplies(session)
}

// =================================================================
// QUICK REPLY — Carrega e injeta
// =================================================================

let quickReplyRetryTimeout: ReturnType<typeof setTimeout> | null = null
let isLoadingQuickReplies = false

async function loadQuickReplies(session: UserSession, attempt = 0): Promise<void> {
  // Cancela retry anterior se existir
  if (attempt === 0 && quickReplyRetryTimeout) {
    clearTimeout(quickReplyRetryTimeout)
    quickReplyRetryTimeout = null
  }

  // Evita chamadas duplicadas enquanto já está carregando
  if (attempt === 0 && isLoadingQuickReplies) {
    log('Quick replies já carregando, ignorando chamada duplicada.')
    return
  }

  const textarea = document.querySelector(SELECTORS.textarea)

  if (!textarea) {
    if (attempt < 10) {
      quickReplyRetryTimeout = setTimeout(() => loadQuickReplies(session, attempt + 1), 500)
    } else {
      log('Textarea não encontrado após 10 tentativas.')
    }
    return
  }

  // Usa cache em memória — evita chamada ao Firebase a cada reinjeção
  const cached = getCachedReplies()
  if (cached) {
    log('Quick replies restaurados do cache.')
    injectQuickReply(cached)
    return
  }

  isLoadingQuickReplies = true
  injectQuickReplyLoading()
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'getQuickReplies',
      username: session.username,
    })
    const replies = response?.replies ?? []
    setCachedReplies(replies)
    injectQuickReply(replies)
  } catch (error) {
    logError('Erro ao carregar quick replies:', error)
    removeQuickReply()
  } finally {
    isLoadingQuickReplies = false
  }
}

// =================================================================
// MONITOR — Botão "Encerrar atendimento"
// Limpa draft da O.S quando o atendimento é encerrado
// =================================================================

let encerrarListenerAttached = false

function watchEncerrarAtendimento(): void {
  if (encerrarListenerAttached) return

  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    const btn = (target as HTMLElement).closest('button.btn_red')
    if (btn?.querySelector('span')?.textContent?.trim() === 'Encerrar atendimento') {
      const chatId = currentChatId
      if (chatId) {
        clearDraft(chatId)
        log(`Draft da O.S limpo para atendimento ${chatId}`)
      }
      // Quick replies são por sessão — mantém cache, não limpa aqui
    }
  })

  encerrarListenerAttached = true
  log('Monitor de encerramento de atendimento ativo.')
}

// =================================================================
// OBSERVER OTIMIZADO (COM DEBOUNCE)
// =================================================================

let observerTimeout: ReturnType<typeof setTimeout> | null = null

const observer = new MutationObserver(() => {
  // Se o Vue continuar disparando mutações na tela, cancelamos a verificação
  if (observerTimeout) clearTimeout(observerTimeout)

  // Espera 150ms de "silêncio" no DOM para agir.
  // Isso impede que a extensão brigue com o vue-virtual-scroller.
  observerTimeout = setTimeout(() => {
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

    if (hasTextarea && !hasQuickReply && currentSession) {
      log('Quick reply sumiu, reinjetando...')
      loadQuickReplies(currentSession)
    }
  }, 150) // 150 milissegundos é o tempo mágico
})

observer.observe(document.body, { childList: true, subtree: true })
init()
