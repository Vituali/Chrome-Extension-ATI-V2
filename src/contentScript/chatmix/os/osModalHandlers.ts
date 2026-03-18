// =================================================================
// MODAL DE O.S — Handlers de eventos internos
// =================================================================

import { SgpData, SgpOccurrenceType } from '../../sgp/types'
import { saveDraft } from './osDraft'
import { processDynamicPlaceholders } from './osModalTypes'

// =================================================================
// SALVAR RASCUNHO AO DIGITAR
// =================================================================

export function setupDraftSaving(
  chatId: string,
  osTextArea: HTMLTextAreaElement,
  modalElement: HTMLElement,
  getSgpData: () => SgpData | null,
): void {
  osTextArea.addEventListener('input', () => {
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
        modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSelectedValue')?.value ?? null,
      occurrenceTypeText:
        modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSearchInput')?.value ?? null,
      sgpData: getSgpData(),
    })
  })
}

// =================================================================
// CHECKBOX — Gerar O.S. trava Ocorrência Encerrada
// =================================================================

export function setupOsCheckbox(
  osCheckbox: HTMLInputElement,
  statusCheckbox: HTMLInputElement,
  statusLabel: HTMLElement,
): void {
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
}

// =================================================================
// BOTÕES DE TEMPLATE
// =================================================================

export function setupTemplateButtons(
  modalElement: HTMLElement,
  osTextArea: HTMLTextAreaElement,
  osBaseText: string,
  occurrenceTypes: SgpOccurrenceType[],
): void {
  modalElement.querySelectorAll<HTMLButtonElement>('.template-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const templateText = btn.getAttribute('data-template-text') ?? ''
      osTextArea.value = processDynamicPlaceholders(osBaseText + templateText).toUpperCase()
      osTextArea.focus()

      // Seleciona tipo de ocorrência automaticamente se template tiver typeId
      const typeId = btn.getAttribute('data-occurrence-type-id')
      const searchInput = modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSearchInput')
      const hiddenInput = modalElement.querySelector<HTMLInputElement>('#occurrenceTypeSelectedValue')

      if (typeId && occurrenceTypes && searchInput && hiddenInput) {
        const found = occurrenceTypes.find((t) => t.id === typeId)
        if (found) {
          searchInput.value = found.text
          hiddenInput.value = found.id
        }
      }
    })
  })
}
