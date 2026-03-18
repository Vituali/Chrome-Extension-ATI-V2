import { ClientData } from '../contentScript/sgp/types'

export interface FirebaseLoginRequest { action: 'firebaseLogin'; email: string; password: string }
export interface OpenInSgpRequest { action: 'openInSgp'; clientData: ClientData; cachedContract: string | null; forceClientId?: string }
export interface GetSgpFormParamsRequest { action: 'getSgpFormParams'; clientData: ClientData; chatId: string; idToken: string }
export interface CreateOccurrenceVisuallyRequest { action: 'createOccurrenceVisually'; data: Record<string, unknown> }
export interface ClearSgpCacheRequest { action: 'clearSgpCache'; cacheKey: string }
export interface GetOsTemplatesRequest { action: 'getOsTemplates'; username: string; idToken: string }
export interface GetQuickRepliesRequest { action: 'getQuickReplies'; username: string }
export interface GetQuickRepliesRequest { action: 'getQuickReplies'; username: string }
export interface RefreshSgpOnlineStatusesRequest { action: 'refreshSgpOnlineStatuses'; clientData: ClientData; chatId: string }
export interface GetGlobalOccurrenceTypesRequest { action: 'getGlobalOccurrenceTypes'; idToken: string }

export type ExtensionRequest =
  | FirebaseLoginRequest
  | OpenInSgpRequest
  | GetSgpFormParamsRequest
  | CreateOccurrenceVisuallyRequest
  | ClearSgpCacheRequest
  | GetOsTemplatesRequest
  | GetQuickRepliesRequest
  | RefreshSgpOnlineStatusesRequest
  | GetGlobalOccurrenceTypesRequest