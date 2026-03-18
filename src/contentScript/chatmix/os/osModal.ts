// =================================================================
// MODAL DE O.S — Orquestrador principal
// =================================================================

import './osModal.css'
import { ClientData, SgpData, SgpOccurrenceType } from '../../sgp/types'
import { formatPhoneNumber } from '../helpers'
import { saveDraft, clearDraft, loadDraft } from './osDraft'
import { currentChatId } from '../state'
import { processDynamicPlaceholders, buildTemplatesHTML, OsTemplate } from './osModalTypes'
import { createModal, buildOsModalBodyHTML } from './osModalUI'
import { loadSgpData } from './osModalSgp'
import { populateOccurrenceTypes } from './osModalSgp'
import { setupDraftSaving, setupOsCheckbox, setupTemplateButtons } from './osModalHandlers'
import { getSession } from '../auth/session'
import type {
  ClearSgpCacheRequest,
  CreateOccurrenceVisuallyRequest,
} from '../../../background/types'

export { processDynamicPlaceholders }

export async function showOSModal(
  allTemplates: OsTemplate[],
  occurrenceTypes: SgpOccurrenceType[],
  extractChatFn: () => string[],
  clientData: ClientData,
): Promise<void> {
  const { firstName, phoneNumber, cpfCnpj, fullName } = clientData
  const formattedPhone = phoneNumber ? formatPhoneNumber(phoneNumber) : ''
  const osBaseText = `${formattedPhone} ${firstName ?? ''} | `
  const cacheKey = cpfCnpj ?? fullName ?? phoneNumber
  const chatId = currentChatId ?? cacheKey ?? 'unknown'
  const session = await getSession()
  const idToken = session?.idToken ?? ''

  try {
    const existingDraft = chatId ? loadDraft(chatId) : null

    // --- Monta modal ---
    const templatesHTML = buildTemplatesHTML(allTemplates)
    const modalConfig = {
      title: 'Criar Ordem de Serviço',
      bodyHTML: buildOsModalBodyHTML(templatesHTML),
      footerButtons: [
        { text: 'Cancelar', className: 'main-btn--cancel', value: 'cancel' },
        { text: 'Copiar', className: 'main-btn--confirm', value: 'copy' },
        { text: 'Preencher no SGP', className: 'main-btn--sgp', value: 'fill_sgp', disabled: true },
      ],
    }

    let sgpData: SgpData | null = null
    const { promise: resultPromise, controller: modalController } = createModal(modalConfig)

    const modalElement = document.querySelector<HTMLElement>('.ati-os-modal')!
    const osTextArea = modalElement.querySelector<HTMLTextAreaElement>('#osTextArea')!
    const sgpButton = modalElement.querySelector<HTMLButtonElement>('button[value="fill_sgp"]')!
    const osCheckbox = modalElement.querySelector<HTMLInputElement>('#shouldCreateOSCheckbox')!
    const statusCheckbox = modalElement.querySelector<HTMLInputElement>('#occurrenceStatusCheckbox')!
    const statusLabel = modalElement.querySelector<HTMLElement>('#lblOccurrenceStatus')!

    // Texto inicial
    osTextArea.value = existingDraft?.osText
      ? existingDraft.osText
      : processDynamicPlaceholders(osBaseText).toUpperCase()

    // Setup de handlers
    setupDraftSaving(chatId, osTextArea, modalElement, () => sgpData)
    setupOsCheckbox(osCheckbox, statusCheckbox, statusLabel)
    setupTemplateButtons(modalElement, osTextArea, osBaseText, occurrenceTypes)

    // Preenche tipos de ocorrência instantaneamente (carregados junto com os templates)
    populateOccurrenceTypes(
      modalElement.querySelector('#modal-occurrence-types-container'),
      occurrenceTypes,
      modalController.signal,
    )

    // Carrega dados SGP (cache ou busca)
    loadSgpData({
      clientData,
      chatId,
      idToken,
      modalElement,
      sgpButton,
      signal: modalController.signal,
      existingDraft,
      onSgpDataLoaded: (data) => { sgpData = data },
    })

    // Aguarda ação do usuário
    const userAction = await resultPromise

    if (userAction.action === 'fill_sgp' && !sgpData) {
      throw new Error('Aguarde o carregamento dos dados do SGP.')
    }

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
      chrome.runtime.sendMessage<ClearSgpCacheRequest>({ action: 'clearSgpCache', cacheKey: chatId })
      console.log('Extensão ATI: O.S copiada.')
    } else if (userAction.action === 'fill_sgp') {
      if (!submissionData.osText || !submissionData.selectedContract || !submissionData.occurrenceType) {
        throw new Error('Descrição, Contrato e Tipo são obrigatórios.')
      }
      if (chatId) clearDraft(chatId)
      chrome.runtime.sendMessage<ClearSgpCacheRequest>({ action: 'clearSgpCache', cacheKey: chatId })
      console.log('Extensão ATI: Abrindo SGP para preenchimento...')
      chrome.runtime.sendMessage<CreateOccurrenceVisuallyRequest>({ action: 'createOccurrenceVisually', data: submissionData })
    }

  } catch (error: unknown) {
    const isCancel = error instanceof Error ? error.message === 'cancel' : error === 'cancel'
    if (!isCancel) {
      console.error('Extensão ATI: Erro no modal O.S.', error)
      throw error
    }
  }
}