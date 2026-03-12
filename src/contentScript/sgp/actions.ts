// =================================================================
// AÇÕES DO SGP — CONTENT SCRIPT
// Apenas envia mensagens para o background processar
// (CORS e chrome.tabs só funcionam no background)
// =================================================================

import { ClientData } from './types'
import { log, logError } from '../chatmix/state'

let isSearchRunning = false

export let cachedContract: string | null = null
export function setCachedContract(value: string | null) {
  cachedContract = value
}

export async function smartOpenSGP(clientData: ClientData): Promise<void> {
  if (isSearchRunning) {
    log('Busca já em andamento, ignorando clique duplo.')
    return
  }

  isSearchRunning = true
  log('Botão SGP pressionado, enviando dados para o background...')

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage({ action: 'openInSgp', clientData, cachedContract }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: background não respondeu em 5s')), 5000),
      ),
    ])

    if (!(response as any)?.success) {
      throw new Error((response as any)?.error ?? 'Erro desconhecido no background.')
    }

    log('SGP aberto com sucesso.')
  } catch (error) {
    logError('Erro ao enviar mensagem para o background:', error)
    throw error
  } finally {
    isSearchRunning = false
  }
}
