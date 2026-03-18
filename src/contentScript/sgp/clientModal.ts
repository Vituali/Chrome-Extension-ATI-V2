// =================================================================
// MODAL DE SELEÇÃO DE CADASTROS DO SGP
// Exibido apenas quando um contato tem mais de 1 registration (Client ID)
// =================================================================

import './clientModal.css'

export async function showClientSelectionModal(
  clients: { id: string; text: string }[],
): Promise<string | null> {
  return new Promise((resolve) => {
    // Remove qualquer modal existente
    const existing = document.querySelector('.ati-client-modal-overlay')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.className = 'ati-client-modal-overlay'

    const modal = document.createElement('div')
    modal.className = 'ati-client-modal'

    const header = document.createElement('div')
    header.className = 'ati-client-modal-header'
    header.innerHTML = '👥 Selecionar Cadastro (SGP)'

    const body = document.createElement('div')
    body.className = 'ati-client-modal-body'

    const helpText = document.createElement('div')
    helpText.className = 'ati-client-modal-help'
    helpText.textContent =
      'Este cliente possui múltiplos cadastros no SGP. Selecione qual você deseja abrir:'
    body.appendChild(helpText)

    clients.forEach((client) => {
      const btn = document.createElement('button')
      btn.className = 'ati-client-modal-btn'
      btn.textContent = `ID ${client.id} - ${client.text}`

      btn.onclick = () => {
        cleanup()
        resolve(client.id)
      }
      body.appendChild(btn)
    })

    const footer = document.createElement('div')
    footer.className = 'ati-client-modal-footer'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'ati-client-modal-cancel'
    cancelBtn.textContent = 'Cancelar'

    cancelBtn.onclick = () => {
      cleanup()
      resolve(null)
    }

    footer.appendChild(cancelBtn)

    modal.appendChild(header)
    modal.appendChild(body)
    modal.appendChild(footer)
    overlay.appendChild(modal)
    document.body.appendChild(overlay)

    function cleanup() {
      overlay.remove()
    }

    // Fecha ao clicar fora
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        cleanup()
        resolve(null)
      }
    })
  })
}
