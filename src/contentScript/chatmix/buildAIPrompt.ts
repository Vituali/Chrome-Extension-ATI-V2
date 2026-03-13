// =================================================================
// buildAIPrompt — Monta prompt limpo para IA a partir do chat
// =================================================================

import { SELECTORS } from './state'

interface ChatMessage {
  role: 'cliente' | 'atendente'
  text: string
}

// Padrões de mensagens de sistema para ignorar
const SYSTEM_PATTERNS = [
  // Transferências e atribuições
  /atendimento transferido/i,
  /atendimento retornado/i,
  /atendimento atribuído/i,
  /transferiu manualmente/i,
  /atendimento está marcado de verde/i,
  // Automação — mensagens de bot
  /será gerenciado pela automação/i,
  /ação automática de encerramento/i,
  /percebi que você não selecionou/i,
  /bom.*vi que você ainda não selecionou/i,
  /nosso horário de atendimento/i,
  /nosso atendimento funciona de/i,
  /espero ter ajudado/i,
  /expediente encerrou/i,
  // Menu do bot
  /seja muito bem-vindo ao atendimento automatizado/i,
  /por favor, digite uma opção válida/i,
  /por favor informe o seu cpf/i,
  /digite o número da opção/i,
  /escolha uma das opções abaixo/i,
  /digite voltar ou encerrar/i,
  /retornar ao menu/i,
  // Respostas automáticas de suporte
  /no aparelho da fibra óptica/i,
  /se power estiver apagado/i,
  /se los estiver vermelho/i,
  // Outros
  /atendimento finalizado/i,
  /bom dia, (?!cliente)/i,
  /boa tarde, (?!cliente)/i,
  /boa noite, (?!cliente)/i,
]

function isSystemMessage(text: string): boolean {
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(text))
}

export function buildAIPrompt(clientName: string): string {
  const chatBody = document.querySelector(SELECTORS.chatBody)
  if (!chatBody) return ''

  const messageBlocks = Array.from(chatBody.querySelectorAll<HTMLElement>('.flex.w-full.align-top'))

  const messages: ChatMessage[] = []

  for (const block of messageBlocks) {
    const msgEl = block.querySelector<HTMLElement>('[id^="message-"]')
    if (!msgEl) continue

    // Ignora mensagens internas de sistema
    if (msgEl.id.includes('message-internal-')) continue
    if (block.querySelector('.bg-neutral-400')) continue

    const isClient = block.classList.contains('justify-start')

    // Pega <p class="mensagem"> ignorando os de citação (reply quote)
    const paragraphs = Array.from(block.querySelectorAll<HTMLElement>('p.mensagem'))

    for (const p of paragraphs) {
      // Ignora parágrafos dentro de divs de citação
      if (p.closest('.cursor-pointer')) continue

      const rawText = p.innerText?.trim() ?? ''
      if (!rawText) continue

      // Remove prefixo "NOME disse:\n" do atendente
      const text = rawText.replace(/^.+disse:\n/i, '').trim()

      if (!text) continue
      if (isSystemMessage(text)) continue

      messages.push({ role: isClient ? 'cliente' : 'atendente', text })
    }
  }

  if (messages.length === 0) return ''

  // Remove respostas numéricas do cliente que eram para o bot
  // (dígito único ou CPF logo no início antes do primeiro atendente humano)
  const firstHumanIndex = messages.findIndex((m) => m.role === 'atendente')
  const filtered = messages.filter((m, i) => {
    if (m.role === 'cliente' && i < firstHumanIndex) {
      // Antes do primeiro atendente humano — remove se for só número
      if (/^\d+$/.test(m.text)) return false
    }
    return true
  })

  const history = filtered
    .map((m) => `[${m.role === 'cliente' ? 'Cliente' : 'Atendente'}] ${m.text}`)
    .join('\n\n')

  return `Você é um atendente de suporte de um provedor de internet chamado ATI Internet.
Responda de forma profissional, objetiva e cordial em português.
Não invente informações técnicas — se não souber, oriente o cliente a aguardar verificação.

=== CLIENTE ===
Nome: ${clientName}

=== HISTÓRICO DA CONVERSA ===
${history}

=== INSTRUÇÃO ===
Com base no histórico acima, sugira a melhor resposta para o atendente enviar agora. Seja direto e natural, sem repetir saudações desnecessárias.`
}
