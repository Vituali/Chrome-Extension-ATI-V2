import { useState, useEffect } from 'react'
import './Popup.css'

interface UserSession {
  uid: string
  username: string
  nomeCompleto: string
  role: 'admin' | 'usuario'
  email: string
}

export const Popup = () => {
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [themeVersion, setThemeVersion] = useState<'modern' | 'legacy'>('modern')

  useEffect(() => {
    chrome.storage.local.get(['ati_user_session', 'ati_theme_version'], (result) => {
      setSession(result.ati_user_session ?? null)
      if (result.ati_theme_version) {
        setThemeVersion(result.ati_theme_version)
      }
      setLoading(false)
    })
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await chrome.storage.local.remove('ati_user_session')
    setSession(null)
    setLoggingOut(false)
  }

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value as 'modern' | 'legacy'
    setThemeVersion(newTheme)
    chrome.storage.local.set({ ati_theme_version: newTheme })
  }

  const handleOpenSite = () => {
    chrome.tabs.create({ url: 'https://vituali.github.io/ATI/' })
  }

  if (loading) {
    return (
      <div className="popup-container">
        <div className="popup-loading">
          <div className="popup-spinner" />
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <div className="popup-logo">ATI</div>
          <span className="popup-title">Extensão ATI</span>
        </div>
        <div className="popup-not-logged">
          <div className="popup-lock">🔒</div>
          <p>Nenhuma sessão ativa</p>
          <span>Acesse o ChatMix para fazer login</span>
        </div>
        <button className="popup-btn popup-btn--site" onClick={handleOpenSite}>
          ↗ Abrir Site ATI
        </button>
      </div>
    )
  }

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="popup-logo">ATI</div>
        <span className="popup-title">Extensão ATI</span>
      </div>

      <div className="popup-user">
        <div className="popup-avatar">{session.nomeCompleto.charAt(0).toUpperCase()}</div>
        <div className="popup-user-info">
          <strong>{session.nomeCompleto}</strong>
          <span>@{session.username}</span>
        </div>
        <div className={`popup-role popup-role--${session.role}`}>
          {session.role === 'admin' ? '⭐ Admin' : '👤 Usuário'}
        </div>
      </div>

      <div className="popup-theme-selector">
        <label htmlFor="theme-select">Estilo do Tema Escuro:</label>
        <select id="theme-select" value={themeVersion} onChange={handleThemeChange}>
          <option value="modern">Moderno (Azul, Neon e Bordas)</option>
          <option value="legacy">Clássico (Cinza e Simples)</option>
        </select>
        <small>*Só surte efeito se o próprio Chatmix estiver usando a "aparência escura" padrão.</small>
      </div>

      <div className="popup-divider" />

      <div className="popup-actions">
        <button className="popup-btn popup-btn--site" onClick={handleOpenSite}>
          ↗ Abrir Site ATI
        </button>
        <button
          className="popup-btn popup-btn--logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? 'Saindo...' : '⏻ Sair'}
        </button>
      </div>
    </div>
  )
}

export default Popup
