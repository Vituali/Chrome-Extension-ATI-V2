// =================================================================
// SGP — OCORRÊNCIAS E ABERTURA DE ABAS
// =================================================================

import { SGP_DNS } from './constants'
import { ClientData } from './constants'
import { getSgpStatus } from './auth'
import { findClientInSgp } from './search'
import { fetchContractOnlineStatus, buildContracts, extractOptions } from './contracts'
import { hasSgpFormCache, getSgpFormCache, setSgpFormCache } from './cache'
import { SgpData, SgpContract, SgpUser, SgpOccurrenceType } from '../../contentScript/sgp/types'

export async function focusOrOpenTab(url: string, clientId?: string): Promise<void> {
  if (clientId) {
    const existing = await chrome.tabs.query({ url: 'https://sgp.atiinternet.com.br/admin/*' })
    const match = existing.find((tab) => tab.url?.includes(`/${clientId}/`))

    if (match) {
      console.log(`Extensão ATI: Focando aba existente do cliente ${clientId}`)
      await chrome.tabs.update(match.id!, { active: true })
      await chrome.windows.update(match.windowId!, { focused: true })
      return
    }
  }

  console.log(`Extensão ATI: Abrindo nova aba — ${url}`)
  await chrome.tabs.create({ url })
}

export async function handleOpenInSgp(
  clientData: ClientData,
  cachedContract: string | null,
): Promise<void> {
  if (cachedContract) {
    console.log(`Extensão ATI: Usando contrato cacheado — ${cachedContract}`)
    const url = `${SGP_DNS}/admin/clientecontrato/${cachedContract}/change/`
    await focusOrOpenTab(url, cachedContract)
    return
  }

  const { isLoggedIn, baseUrl } = await getSgpStatus()

  if (!isLoggedIn) {
    console.warn('Extensão ATI: Não logado no SGP, abrindo login...')
    await focusOrOpenTab(`${baseUrl}/accounts/login/`)
    return
  }

  const hasData =
    clientData.cpfCnpj ||
    (clientData.fullName && clientData.fullName !== 'Cliente') ||
    clientData.phoneNumber

  if (!hasData) {
    console.warn('Extensão ATI: Sem dados do cliente, abrindo admin como fallback.')
    await focusOrOpenTab(`${baseUrl}/admin/`)
    return
  }

  const clients = await findClientInSgp(baseUrl, clientData)

  if (clients && clients.length > 0) {
    const client = clients[0]
    console.log(`Extensão ATI: Cliente encontrado — ID ${client.id}`)
    await focusOrOpenTab(`${baseUrl}/admin/cliente/${client.id}/contratos/`, client.id)
  } else {
    console.warn('Extensão ATI: Cliente não encontrado, abrindo admin geral.')
    await focusOrOpenTab(`${baseUrl}/admin/`)
  }
}

export async function getSgpFormParams(clientData: ClientData, chatId: string): Promise<SgpData> {
  const { isLoggedIn, baseUrl } = await getSgpStatus()
  if (!isLoggedIn) throw new Error('Não está logado no SGP.')

  const clients = await findClientInSgp(baseUrl, clientData)
  if (!clients || clients.length === 0) throw new Error('Cliente não encontrado no SGP.')

  if (hasSgpFormCache(chatId)) {
    console.log(`Extensão ATI: Usando cache SGP para atendimento ${chatId}`)
    return getSgpFormCache(chatId) as SgpData
  }

  console.log(`Extensão ATI: Buscando dados do formulário para ${clients.length} cliente(s).`)

  let allContracts: SgpContract[] = []
  let responsibleUsers: SgpUser[] = []
  let occurrenceTypes: SgpOccurrenceType[] = []

  for (let i = 0; i < clients.length; i++) {
    const client = clients[i]
    const url = `${baseUrl}/admin/atendimento/cliente/${client.id}/ocorrencia/add/`

    try {
      const response = await fetch(url, {
        credentials: 'include',
        signal: AbortSignal.timeout(10000),
      })
      const html = await response.text()

      if (html.includes('id_username') && html.includes('id_password')) {
        await chrome.storage.local.remove('sgp_status_cache')
        throw new Error('Sua sessão no SGP expirou. Faça o login novamente.')
      }

      // Busca status online/offline dos contratos deste cliente
      const onlineStatusMap = await fetchContractOnlineStatus(baseUrl, client.id)

      const contracts = await buildContracts(
        baseUrl,
        client,
        html,
        clients.length > 1,
        onlineStatusMap,
      )

      allContracts = allContracts.concat(contracts)

      if (i === 0) {
        responsibleUsers = extractOptions(
          html,
          /<select[^>]+id=['"]id_responsavel['"][^>]*>([\s\S]*?)<\/select>/,
        ).map((u) => ({ id: u.id, username: u.text.toLowerCase() }))

        occurrenceTypes = extractOptions(
          html,
          /<select[^>]+id=['"]id_tipo['"][^>]*>([\s\S]*?)<\/select>/,
        )
      }
    } catch (error) {
      console.error(`Extensão ATI: Falha ao buscar dados para cliente ${client.id}.`, error)
      throw error
    }
  }

  if (allContracts.length === 0) throw new Error('Nenhum contrato encontrado.')

  const result = {
    clientSgpId: clients[0].id,
    contracts: allContracts,
    responsibleUsers,
    occurrenceTypes,
  }

  setSgpFormCache(chatId, result)
  return result
}

// Nova função exclusiva para atualizar status sem sobrecarregar SGP
export async function refreshSgpOnlineStatuses(
  clientData: ClientData,
  chatId: string,
): Promise<SgpData | null> {
  const cached = getSgpFormCache(chatId)
  if (!cached || !cached.clientSgpId) return null

  const domain = await chrome.storage.local.get('sgp_domain')
  if (!domain.sgp_domain) return cached
  const baseUrl = `https://${domain.sgp_domain}/sgp/`

  try {
    const onlineMap = await fetchContractOnlineStatus(baseUrl, cached.clientSgpId)

    cached.contracts = cached.contracts.map((contract) => ({
      ...contract,
      isOnline: onlineMap.get(contract.id) === true
    }))

    setSgpFormCache(chatId, cached)
    return cached
  } catch (error) {
    console.error('Extensão ATI: Falha ao renovar status online.', error)
    return cached
  }
}

export async function createOccurrenceVisually(data: Record<string, unknown>): Promise<void> {
  const { isLoggedIn, baseUrl } = await getSgpStatus()
  if (!isLoggedIn) throw new Error('Não está logado no SGP.')

  const url = `${baseUrl}/admin/atendimento/cliente/${data.clientSgpId}/ocorrencia/add/`
  await chrome.storage.local.set({ pendingSgpData: data })
  await chrome.tabs.create({ url, active: true })
}
