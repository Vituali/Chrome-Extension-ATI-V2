// =================================================================
// EXTRAÇÃO DE DADOS DO CLIENTE DO DOM DO CHATMIX
// =================================================================

import { ClientData } from '../sgp/types'
import { SELECTORS, log, lastExtractedData, setLastExtractedData } from './state'
import { findCPF, collectTextFromMessages } from './helpers'

export async function getClientData(): Promise<ClientData> {
  const matches = window.location.href.match(/\/(\d+)$/)
  const chatId = matches ? matches[1] : null

  // Cache: se é o mesmo chat e já tem CPF, retorna imediato
  if (chatId && lastExtractedData.chatId === chatId && lastExtractedData.data?.cpfCnpj) {
    log('⚡ Dados recuperados do cache de sessão.')
    return lastExtractedData.data
  }

  log('🔍 Extraindo dados do DOM...')

  // Nome e telefone do header do painel direito
  let fullName = ''
  let phoneNumber = ''

  const nameEl = document.querySelector(SELECTORS.clientName)
  const phoneEl = document.querySelector(SELECTORS.clientPhone)

  if (nameEl) fullName = nameEl.textContent?.trim() ?? ''
  if (phoneEl) phoneNumber = phoneEl.textContent?.replace(/\D/g, '') ?? ''

  // CPF nas mensagens do chat
  const chatTexts = collectTextFromMessages()
  const cpfCnpj = findCPF(chatTexts)

  // Fallback de nome: tenta extrair da saudação do bot
  if ((!fullName || fullName.toUpperCase() === 'CLIENTE') && chatTexts.length > 0) {
    const welcomeMsg = chatTexts.find(
      (t) => t.includes('Olá ') && !t.includes('Escolha uma das opções'),
    )
    if (welcomeMsg) {
      fullName = welcomeMsg.replace(/Olá\s+/i, '').trim()
      log(`Nome extraído da saudação do bot: ${fullName}`)
    }
  }

  // Verifica se o cliente está identificado
  const hasName = fullName && fullName.toUpperCase() !== 'CLIENTE'
  const headers = Array.from(document.querySelectorAll('h1'))
  const isUnidentifiedPage = headers.some((h) => h.textContent?.includes('Cliente não identificado'))
  const isIdentified = !!hasName && !isUnidentifiedPage

  const data: ClientData = {
    fullName: fullName || 'Cliente',
    firstName: fullName ? fullName.split(' ')[0].toUpperCase() : '',
    phoneNumber: phoneNumber || '',
    cpfCnpj: cpfCnpj,
    isIdentified,
  }

  log('Dados extraídos:', data)
  setLastExtractedData(chatId, data)
  return data
}