// =================================================================
// INTERFACES E TIPOS DO SGP
// =================================================================

export interface SgpStatus {
  isLoggedIn: boolean
  baseUrl: string
}

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
}

export interface SgpUser {
  id: string
  username: string
}

export interface SgpOccurrenceType {
  id: string
  text: string
}

export interface SgpData {
  clientSgpId: string
  contracts: SgpContract[]
  responsibleUsers: SgpUser[]
  occurrenceTypes: SgpOccurrenceType[]
}

export interface SgpStatusCache {
  isLoggedIn: boolean
  baseUrl: string
  timestamp: number
}

export interface OsTemplate {
  id: string
  title: string
  text: string
  category: string
  occurrenceTypeId?: string | number
  keywords?: string[]
}

export interface ModalButton {
  text: string
  className: string
  value: string
  disabled?: boolean
}

export interface ModalResult {
  action: string
  data: {
    osText: string
    selectedContract: string | null
    occurrenceType: string | null
    occurrenceStatus: '1' | '2'
    shouldCreateOS: boolean
  }
}
