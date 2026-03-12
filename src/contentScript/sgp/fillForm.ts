// =================================================================
// CONTENT SCRIPT — SGP
// Usa postMessage para passar dados ao sgpFill.js sem scripts inline
// =================================================================

console.log('Extensão ATI: SGP content script carregado.')

const isOccurrencePage = window.location.pathname.includes('/ocorrencia/add/')

if (isOccurrencePage) {
  chrome.storage.local.get(['pendingSgpData', 'ati_user_session'], (result) => {
    const data = result.pendingSgpData
    const session = result.ati_user_session
    const username = session?.username?.toLowerCase() ?? ''

    if (!data) {
      console.log('Extensão ATI: Sem dados pendentes.')
      return
    }

    console.log('Extensão ATI: Dados pendentes encontrados, carregando sgpFill.js...')
    chrome.storage.local.remove('pendingSgpData')

    // Injeta o script externo primeiro
    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('src/contentScript/sgp/sgpFill.js')

    // Quando carregar, envia os dados via postMessage
    script.onload = () => {
      window.postMessage(
        {
          type: 'ATI_SGP_FILL',
          data,
          username,
        },
        '*',
      )
      script.remove()
    }

    document.documentElement.appendChild(script)
  })
}
