// =================================================================
// FUNÇÕES UTILITÁRIAS
// =================================================================

import { SELECTORS, log } from './state'

// --- Validação de CPF ---
export function isValidCPF(cpf: string): boolean {
  if (typeof cpf !== 'string') return false
  cpf = cpf.replace(/[^\d]/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 1; i <= 9; i++) sum += parseInt(cpf.substring(i - 1, i)) * (11 - i)
  let remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  if (remainder !== parseInt(cpf.substring(9, 10))) return false

  sum = 0
  for (let i = 1; i <= 10; i++) sum += parseInt(cpf.substring(i - 1, i)) * (12 - i)
  remainder = (sum * 10) % 11
  if (remainder === 10 || remainder === 11) remainder = 0
  return remainder === parseInt(cpf.substring(10, 11))
}

// --- Validação de CNPJ ---
export function isValidCNPJ(cnpj: string): boolean {
  if (typeof cnpj !== 'string') return false
  cnpj = cnpj.replace(/[^\d]/g, '')
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false

  let length = cnpj.length - 2
  let numbers = cnpj.substring(0, length)
  const digits = cnpj.substring(length)
  let sum = 0
  let pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += Number(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result != Number(digits.charAt(0))) return false

  length += 1
  numbers = cnpj.substring(0, length)
  sum = 0
  pos = length - 7

  for (let i = length; i >= 1; i--) {
    sum += Number(numbers.charAt(length - i)) * pos--
    if (pos < 2) pos = 9
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return result == Number(digits.charAt(1))
}

// --- Busca CPF/CNPJ em lista de textos ---
export function findCPF(allTexts: string[]): string | null {
  const cpfCnpjRegex = /\b(\d{11}|\d{14})\b/g
  const blacklist = ['código de barras', 'boleto', 'fatura', 'pix', 'linha digitável']
  const validMatches: string[] = []

  for (const text of allTexts) {
    if (blacklist.some((keyword) => text.toLowerCase().includes(keyword))) continue

    const cleanText = text.replace(/[.\-\/]/g, '')
    const potentialMatches = cleanText.match(cpfCnpjRegex)

    if (potentialMatches) {
      for (const match of potentialMatches) {
        if (match.length === 11 && isValidCPF(match)) validMatches.push(match)
        else if (match.length === 14 && isValidCNPJ(match)) validMatches.push(match)
      }
    }
  }

  return validMatches.length > 0 ? validMatches[validMatches.length - 1] : null
}

// --- Coleta textos das mensagens do chat ---
// Otimizado: chats curtos pega tudo, longos pega início (bot) + fim (atual)
export function collectTextFromMessages(): string[] {
  const chatBody = document.querySelector(SELECTORS.chatBody)
  if (!chatBody) return []

  const allMessages = Array.from(chatBody.querySelectorAll(SELECTORS.messageParagraph))

  if (allMessages.length <= 100) {
    return allMessages.map((p) => p.textContent?.trim() ?? '')
  }

  const start = allMessages.slice(0, 50)
  const end = allMessages.slice(-50)
  return [...start, ...end].map((p) => p.textContent?.trim() ?? '')
}

// --- Formata número de telefone ---
export function formatPhoneNumber(phone: string): string {
  if (!phone) return ''
  let str = phone.replace(/\D/g, '')

  if (str.startsWith('55') && str.length >= 12) str = str.substring(2)

  if (str.length >= 10) {
    const ddd = str.substring(0, 2)
    const rest = str.substring(2)

    if (rest.length === 9) return `${ddd} ${rest.substring(0, 5)}-${rest.substring(5)}`
    if (rest.length === 8) return `${ddd} ${rest.substring(0, 4)}-${rest.substring(4)}`
  }

  return phone
}

// --- Seta valor em input controlado pelo Vue/React ---
export function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype

  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    log(`Valor setado no input: ${value}`)
  }
}
