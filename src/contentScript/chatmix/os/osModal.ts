// =================================================================
// MODAL DE O.S — Portado e adaptado para TypeScript
// =================================================================

import './osModal.css'
import { ClientData, SgpData, SgpContract } from '../../sgp/types'
import { formatPhoneNumber } from '../helpers'
import { saveDraft, loadDraft, clearDraft } from './osDraft'
import { currentChatId } from '../state'

// =================================================================
// TIPOS LOCAIS
// =================================================================

interface ModalButton {
  text: string
  className: string
  value: string
  disabled?: boolean
}

interface ModalConfig {
  title: string
  bodyHTML: string
  footerButtons: ModalButton[]
}

interface ModalResult {
  action: string
  data: {
    osText: string
    selectedContract: string | null
    occurrenceType: string | null
    occurrenceStatus: '1' | '2'
    shouldCreateOS: boolean
  }
}

interface OsTemplate {
  id: string
  title: string
  text: string
  category: string
  occurrenceTypeId?: string | number
  keywords?: string[]
}

// =================================================================
// PLACEHOLDERS DINÂMICOS
// =================================================================

export function processDynamicPlaceholders(text: string): string {
  if (typeof text !== 'string') return ''

  const now = new Date()
  const hora = now.getHours()

  const saudacao =
    hora >= 5 && hora < 12 ? 'Bom dia' : hora >= 12 && hora < 18 ? 'Boa tarde' : 'Boa noite'

  const despedida =
    hora >= 5 && hora < 12
      ? 'Tenha uma excelente manhã'
      : hora >= 12 && hora < 18
        ? 'Tenha uma excelente tarde'
        : 'Tenha uma excelente noite'

  const dia = String(now.getDate()).padStart(2, '0')
  const mes = String(now.getMonth() + 1).padStart(2, '0')
  const ano = now.getFullYear()
  const dataHoje = `${dia}/${mes}/${ano}`

  return text
    .replace(/\[SAUDACAO\]/gi, saudacao)
    .replace(/\[DESPEDIDA\]/gi, despedida)
    .replace(/\[HOJE\]/gi, dataHoje)
}

// =================================================================
// POPULAR CONTRATOS
// =================================================================

function populateContracts(container: Element | null, contracts: SgpContract[]): void {
  if (!container) return

  const valid = Array.isArray(contracts) ? contracts.filter((c) => c?.id) : []

  if (valid.length === 0) {
    container.innerHTML = `
      <h4 class="modal-category-title">Selecione o Contrato</h4>
      <div class="modal-loader">Nenhum contrato encontrado.</div>
    `
    return
  }

  const html = valid
    .map(
      (contract, index) => `
      <label class="template-btn contract-item">
        <input type="radio" name="selected_contract" value="${contract.id}" ${index === 0 ? 'checked' : ''}>
        <span>${contract.text}</span>
      </label>
    `,
    )
    .join('')

  container.innerHTML = `
    <h4 class="modal-category-title">Selecione o Contrato</h4>
    <div class="modal-btn-group">${html}</div>
  `
}

// =================================================================
// POPULAR TIPOS DE OCORRÊNCIA
// =================================================================

function populateOccurrenceTypes(
  container: Element | null,
  occurrenceTypes: { id: string; text: string }[],
): void {
  if (!container) return

  const valid = Array.isArray(occurrenceTypes) ? occurrenceTypes.filter((t) => t?.id) : []

  if (valid.length === 0) {
    container.innerHTML = `
      <h4 class="modal-category-title">Tipo de Ocorrência</h4>
      <div class="modal-loader">Nenhum tipo encontrado.</div>
    `
    return
  }

  container.innerHTML = `
    <h4 class="modal-category-title">Tipo de Ocorrência</h4>
    <div class="searchable-select-container">
      <input type="text" id="occurrenceTypeSearchInput" class="modal-textarea" placeholder="Pesquisar tipo..." autocomplete="off">
      <input type="hidden" id="occurrenceTypeSelectedValue">
      <div id="occurrenceTypeOptions" class="searchable-options-list">
        ${valid.map((t) => `<div class="searchable-option" data-value="${t.id}">${t.text}</div>`).join('')}
      </div>
    </div>
  `

  const searchInput = container.querySelector<HTMLInputElement>('#occurrenceTypeSearchInput')!
  const hiddenInput = container.querySelector<HTMLInputElement>('#occurrenceTypeSelectedValue')!
  const optionsContainer = container.querySelector<HTMLDivElement>('#occurrenceTypeOptions')!
  const allOptions = Array.from(
    optionsContainer.querySelectorAll<HTMLDivElement>('.searchable-option'),
  )

  if (valid.length > 0) {
    searchInput.value = valid[0].text
    hiddenInput.value = valid[0].id
  }

  searchInput.addEventListener('focus', () => {
    optionsContainer.style.display = 'block'
    searchInput.select()
  })

  searchInput.addEventListener('input', () => {
    const filter = searchInput.value.toUpperCase()
    hiddenInput.value = ''
    let hasVisible = false

    allOptions.forEach((opt) => {
      const matches = (opt.textContent ?? '').toUpperCase().includes(filter)
      opt.style.display = matches ? '' : 'none'
      if (matches) hasVisible = true
    })

    optionsContainer.style.display = hasVisible ? 'block' : 'none'
  })

  allOptions.forEach((opt) => {
    opt.addEventListener('mousedown', (e) => {
      e.preventDefault()
      hiddenInput.value = opt.getAttribute('data-value') ?? ''
      searchInput.value = opt.innerText
      optionsContainer.style.display = 'none'
    })
  })

  document.addEventListener('click', (e) => {
    if (!container.contains(e.target as Node)) {
      optionsContainer.style.display = 'none'
    }
  })
}

// =================================================================
// CRIAR MODAL GENÉRICO
// =================================================================

function createModal(config: ModalConfig): Promise<ModalResult> {
  return new Promise((resolve, reject) => {
    document.querySelector('.ati-os-modal-overlay')?.remove()

    const overlay = document.createElement('div')
    overlay.className = 'ati-os-modal-overlay'

    const modal = document.createElement('div')
    modal.className = 'ati-os-modal'

    const buttonsHTML = config.footerButtons
      .map(
        (btn) =>
          `<button class="main-btn ${btn.className}" value="${btn.value}" ${btn.disabled ? 'disabled' : ''}>${btn.text}</button>`,
      )
      .join('')

    modal.innerHTML = `
      <div class="ati-os-modal-header">${config.title}</div>
      <div class="ati-os-modal-body">${config.bodyHTML}</div>
      <div class="ati-os-modal-footer">${buttonsHTML}</div>
    `

    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    const closeModal = (reason: string) => {
      overlay.remove()
      reject(new Error(reason))
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal('cancel')
    })

    modal.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest<HTMLButtonElement>('.main-btn')
      if (!target) return

      const action = target.value

      if (action === 'cancel') {
        closeModal('cancel')
        return
      }

      const osTextArea = modal.querySelector<HTMLTextAreaElement>('#osTextArea')
      const selectedContractInput = modal.querySelector<HTMLInputElement>(
        'input[name="selected_contract"]:checked',
      )
      const occurrenceTypeInput = modal.querySelector<HTMLInputElement>(
        '#occurrenceTypeSelectedValue',
      )
      const statusCheckbox = modal.querySelector<HTMLInputElement>('#occurrenceStatusCheckbox')
      const createOSCheckbox = modal.querySelector<HTMLInputElement>('#shouldCreateOSCheckbox')

      const data = {
        osText: osTextArea?.value ?? '',
        selectedContract: selectedContractInput?.value ?? null,
        occurrenceType: occurrenceTypeInput?.value ?? null,
        occurrenceStatus: (statusCheckbox?.checked ? '1' : '2') as '1' | '2',
        shouldCreateOS: createOSCheckbox?.checked ?? false,
      }

      overlay.remove()
      resolve({ action, data })
    })
  })
}

// =================================================================
// SHOW OS MODAL — FUNÇÃO PRINCIPAL
// =================================================================

export async function showOSModal(
  allTemplates: OsTemplate[],
  extractChatFn: () => string[],
  clientData: ClientData,
): Promise<void> {
  const { firstName, phoneNumber, cpfCnpj, fullName } = clientData
  const formattedPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : ''
  const osBaseText = `${formattedPhone} ${firstName ?? ''} | `
  const cacheKey = cpfCnpj ?? fullName ?? phoneNumber
  const chatId = currentChatId ?? cacheKey ?? 'unknown'

  // --- Carrega rascunho anterior se existir ---
  const existingDraft = chatId ? loadDraft(chatId) : null

  // --- Prepara templates ---
  const clientChatTexts = extractChatFn()

  const templatesByCategory = (allTemplates ?? []).reduce<Record<string, OsTemplate[]>>(
    (acc, t) => {
      if (t.category === 'quick_reply') return acc
      const cat = t.category ?? 'Outros'
      ;(acc[cat] = acc[cat] ?? []).push(t)
      return acc
    },
    {},
  )

  let templatesHTML = ''
  for (const [cat, temps] of Object.entries(templatesByCategory)) {
    templatesHTML +=
      `<h4 class="modal-category-title">${cat}</h4><div class="modal-btn-group">` +
      temps
        .filter((t) => t.text && t.title) // ← filtra incompletos
        .map(
          (t) =>
            `<button class="template-btn" data-template-text="${t.text.replace(/"/g, '&quot;')}" data-occurrence-type-id="${t.occurrenceTypeId ?? ''}">${t.title}</button>`,
        )
        .join('') +
      `</div>`
  }

  const modalConfig: ModalConfig = {
    title: 'Criar Ordem de Serviço',
    bodyHTML: `
      <div id="modal-sgp-contracts-container"><div class="modal-loader">Carregando contratos...</div></div>
      <div id="modal-occurrence-types-container"><div class="modal-loader">Carregando tipos de ocorrência...</div></div>

      <label class="modal-textarea-label" for="osTextArea">Descrição</label>
      <textarea id="osTextArea" class="modal-textarea"></textarea>

      <div class="modal-checkboxes">
        <label class="modal-checkbox-label" id="lblOccurrenceStatus">
          <span>Ocorrência Encerrada?</span>
          <input type="checkbox" id="occurrenceStatusCheckbox" checked>
          <span class="toggle-track"></span>
        </label>
        <label class="modal-checkbox-label">
          <span>Gerar O.S.?</span>
          <input type="checkbox" id="shouldCreateOSCheckbox">
          <span class="toggle-track"></span>
        </label>
      </div>

      <div class="modal-templates-container">
        ${templatesHTML}
      </div>
    `,
    footerButtons: [
      { text: 'Cancelar', className: 'main-btn--cancel', value: 'cancel' },
      { text: 'Copiar', className: 'main-btn--confirm', value: 'copy' },
      { text: 'Preencher no SGP', className: 'main-btn--sgp', value: 'fill_sgp', disabled: true },
    ],
  }

  // sgpData começa null, será preenchido após resposta do background
  let sgpData: SgpData | null = null

  try {
    const resultPromise = createModal(modalConfig)

    const modalElement = document.querySelector<HTMLElement>('.ati-os-modal')!
    const osTextArea = modalElement.querySelector<HTMLTextAreaElement>('#osTextArea')!
    const sgpButton = modalElement.querySelector<HTMLButtonElement>('button[value="fill_sgp"]')!
    const osCheckbox = modalElement.querySelector<HTMLInputElement>('#shouldCreateOSCheckbox')!
    const statusCheckbox = modalElement.querySelector<HTMLInputElement>(
      '#occurrenceStatusCheckbox',
    )!
    const statusLabel = modalElement.querySelector<HTMLElement>('#lblOccurrenceStatus')!

    // Texto inicial — restaura draft ou usa base
    if (existingDraft?.osText) {
      osTextArea.value = existingDraft.osText
    } else {
      osTextArea.value = processDynamicPlaceholders(osBaseText).toUpperCase()
    }

    // Salva rascunho enquanto digita
    osTextArea.addEventListener('input', () => {
      if (chatId) {
        saveDraft(chatId, {
          osText: osTextArea.value,
          selectedContract:
            modalElement.querySelector<HTMLInputElement>('input[name="selected_contract"]:checked')
              ?.value ?? null,
          selectedContractText:
            modalElement
              .querySelector<HTMLInputElement>('input[name="selected_contract"]:checked')
              ?.closest('label')
              ?.querySelector('span')?.textContent ?? null,
          occurrenceType:
            modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSelectedValue')?.value ??
            null,
          occurrenceTypeText:
            modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSearchInput')?.value ??
            null,
          sgpData: sgpData,
        })
      }
    })

    // Gerar O.S. trava Ocorrência Encerrada
    osCheckbox.addEventListener('change', () => {
      if (osCheckbox.checked) {
        statusCheckbox.checked = false
        statusCheckbox.disabled = true
        statusLabel.classList.add('disabled')
      } else {
        statusCheckbox.disabled = false
        statusCheckbox.checked = true
        statusLabel.classList.remove('disabled')
      }
    })

    // Clique nos templates
    modalElement.querySelectorAll<HTMLButtonElement>('.template-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const templateText = btn.getAttribute('data-template-text') ?? ''
        osTextArea.value = processDynamicPlaceholders(osBaseText + templateText).toUpperCase()
        osTextArea.focus()

        // Seleciona tipo de ocorrência automaticamente
        const typeId = btn.getAttribute('data-occurrence-type-id')
        const searchInput = modalElement.querySelector<HTMLInputElement>(
          '#occurrenceTypeSearchInput',
        )
        const hiddenInput = modalElement.querySelector<HTMLInputElement>(
          '#occurrenceTypeSelectedValue',
        )

        if (typeId && sgpData?.occurrenceTypes && searchInput && hiddenInput) {
          const found = sgpData.occurrenceTypes.find((t) => t.id === typeId)
          if (found) {
            searchInput.value = found.text
            hiddenInput.value = found.id
          }
        }
      })
    })

    // Busca dados do SGP — usa cache do draft se disponível
    if (existingDraft?.sgpData) {
      sgpData = existingDraft.sgpData as SgpData
      populateContracts(
        modalElement.querySelector('#modal-sgp-contracts-container'),
        sgpData.contracts,
      )
      populateOccurrenceTypes(
        modalElement.querySelector('#modal-occurrence-types-container'),
        sgpData.occurrenceTypes,
      )
      sgpButton.disabled = false

      // Restaura contrato selecionado
      if (existingDraft.selectedContract) {
        const radio = modalElement.querySelector<HTMLInputElement>(
          `input[name="selected_contract"][value="${existingDraft.selectedContract}"]`,
        )
        if (radio) radio.checked = true
      }

      // Restaura tipo de ocorrência
      if (existingDraft.occurrenceType && existingDraft.occurrenceTypeText) {
        const searchInput = modalElement.querySelector<HTMLInputElement>(
          '#occurrenceTypeSearchInput',
        )
        const hiddenInput = modalElement.querySelector<HTMLInputElement>(
          '#occurrenceTypeSelectedValue',
        )
        if (searchInput && hiddenInput) {
          searchInput.value = existingDraft.occurrenceTypeText
          hiddenInput.value = existingDraft.occurrenceType
        }
      }
    } else {
      chrome.runtime
        .sendMessage({ action: 'getSgpFormParams', clientData })
        .then((response: any) => {
          if (response?.success) {
            sgpData = response.data as SgpData
            populateContracts(
              modalElement.querySelector('#modal-sgp-contracts-container'),
              sgpData.contracts,
            )
            populateOccurrenceTypes(
              modalElement.querySelector('#modal-occurrence-types-container'),
              sgpData.occurrenceTypes,
            )
            sgpButton.disabled = false
          } else {
            throw new Error(response?.message ?? 'Falha ao buscar dados do SGP.')
          }
        })
        .catch((error: Error) => {
          console.error('Extensão ATI: Erro ao buscar dados SGP.', error)
          modalElement.querySelectorAll('.modal-loader').forEach((l) => {
            l.textContent = `Erro: ${error.message}`
          })
          sgpButton.textContent = 'Falha no SGP'
        })
    }

    // Aguarda ação do usuário
    const userAction = await resultPromise

    if (userAction.action === 'fill_sgp' && !sgpData) {
      throw new Error('Aguarde o carregamento dos dados do SGP.')
    }

    // Resolve contrato e cliente correto — assertion única aqui
    const resolvedSgpData = sgpData as unknown as SgpData
    const validContracts = resolvedSgpData?.contracts?.filter((c) => c?.id) ?? []
    const selectedContractId = userAction.data.selectedContract ?? validContracts[0]?.id ?? null
    const selectedContractObj = validContracts.find((c) => c.id === selectedContractId)
    const correctClientSgpId = selectedContractObj?.clientId ?? resolvedSgpData?.clientSgpId ?? null

    const submissionData = {
      ...clientData,
      clientSgpId: correctClientSgpId,
      osText: userAction.data.osText,
      selectedContract: selectedContractId,
      occurrenceType: userAction.data.occurrenceType,
      shouldCreateOS: userAction.data.shouldCreateOS,
      occurrenceStatus: userAction.data.occurrenceStatus,
      responsibleUsers: resolvedSgpData?.responsibleUsers ?? [],
    }

    if (userAction.action === 'copy') {
      await navigator.clipboard.writeText(submissionData.osText)
      if (chatId) clearDraft(chatId)
      console.log('Extensão ATI: O.S copiada.')
    } else if (userAction.action === 'fill_sgp') {
      if (
        !submissionData.osText ||
        !submissionData.selectedContract ||
        !submissionData.occurrenceType
      ) {
        throw new Error('Descrição, Contrato e Tipo são obrigatórios.')
      }
      if (chatId) clearDraft(chatId)
      console.log('Extensão ATI: Abrindo SGP para preenchimento...')
      chrome.runtime.sendMessage({ action: 'createOccurrenceVisually', data: submissionData })
    }
  } catch (error: any) {
    if (error.message !== 'cancel') {
      console.error('Extensão ATI: Erro no modal O.S.', error)
      throw error
    }
  } finally {
    if (cacheKey) {
      chrome.runtime.sendMessage({ action: 'clearSgpCache', cacheKey })
    }
  }
}
