// =================================================================
// BACKGROUND SERVICE WORKER — ENTRY POINT
// =================================================================

import { handleFirebaseLogin, getOsTemplates, getQuickReplies } from './firebase'
import { handleOpenInSgp, getSgpFormParams, createOccurrenceVisually } from './sgp/occurrence'
import { deleteSgpFormCache } from './sgp/cache'

console.log('Extensão ATI: Background iniciado.')

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'firebaseLogin') {
    handleFirebaseLogin(request.email, request.password)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'openInSgp') {
    handleOpenInSgp(request.clientData, request.cachedContract)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'getSgpFormParams') {
    getSgpFormParams(request.clientData)
      .then((data) => sendResponse({ success: true, data }))
      .catch((error) => sendResponse({ success: false, message: error.message }))
    return true
  }

  if (request.action === 'createOccurrenceVisually') {
    createOccurrenceVisually(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }))
    return true
  }

  if (request.action === 'clearSgpCache') {
    deleteSgpFormCache(request.cacheKey)
    sendResponse({ success: true })
    return true
  }

  if (request.action === 'getOsTemplates') {
    getOsTemplates(request.username, request.idToken)
      .then((templates) => sendResponse({ success: true, templates }))
      .catch((error) => sendResponse({ success: false, templates: [], error: error.message }))
    return true
  }

  if (request.action === 'getQuickReplies') {
    getQuickReplies(request.username)
      .then((replies) => sendResponse({ success: true, replies }))
      .catch((error) => sendResponse({ success: false, replies: [], error: error.message }))
    return true
  }
})
