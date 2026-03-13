// =================================================================
// SGP — CONSTANTES E INTERFACES
// =================================================================

export const SGP_DNS = 'https://sgp.atiinternet.com.br'
export const SGP_IP = 'http://201.158.20.35:8000'
export const LOGIN_CACHE_TTL_MS = 2 * 60 * 60 * 1000 // 2 horas

export interface ClientData {
  fullName: string
  firstName: string
  phoneNumber: string
  cpfCnpj: string | null
  isIdentified: boolean
}

export interface SgpClient {
  id: string
  text: string
}

export interface SgpContract {
  id: string
  text: string
  clientId: string
  online?: boolean | null // null = desconhecido
}
