// =================================================================
// SGP — BUSCA DE CLIENTES
// =================================================================

import { ClientData, SgpClient } from './constants'

export async function executeSearch(url: string): Promise<SgpClient[] | null> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      signal: AbortSignal.timeout(8000),
    })
    const data: SgpClient[] = await response.json()
    console.log(`Extensão ATI: Busca retornou ${data?.length ?? 0} resultado(s) — ${url}`)
    return data?.length > 0 ? data : null
  } catch (error) {
    console.error(`Extensão ATI: Erro na busca — ${url}`, error)
    return null
  }
}

export async function findClientInSgp(
  baseUrl: string,
  clientData: ClientData,
): Promise<SgpClient[] | null> {
  const { cpfCnpj, fullName, phoneNumber } = clientData
  const base = `${baseUrl}/public/autocomplete/ClienteAutocomplete`

  if (cpfCnpj) {
    console.log('Extensão ATI: Buscando por CPF/CNPJ...')
    const result = await executeSearch(`${base}?tconsulta=cpfcnpj&term=${cpfCnpj}`)
    if (result) return result
  }

  if (fullName && fullName !== 'Cliente') {
    console.log('Extensão ATI: Buscando por nome...')
    const result = await executeSearch(
      `${base}?tconsulta=nome&term=${encodeURIComponent(fullName)}`,
    )
    if (result) return result
  }

  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/\D/g, '').replace(/^55/, '').substring(0, 11)
    console.log(`Extensão ATI: Buscando por telefone — ${cleanPhone}`)
    const result = await executeSearch(`${base}?tconsulta=telefone&term=${cleanPhone}`)
    if (result) return result
  }

  console.warn('Extensão ATI: Cliente não encontrado por nenhum critério.')
  return null
}
