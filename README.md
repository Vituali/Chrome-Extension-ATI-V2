<div align="center">

<img src="public/img/logo-128.png" alt="ATI Logo" width="80" />

# ATI — Customer Support Assistant

**Chrome extension to streamline customer support via ChatMix, integrated with SGP.**

🇧🇷 [Português](README.pt-br.md) · 🇺🇸 English

[![Chrome Web Store](https://img.shields.io/chrome-web-store/v/mlgmmjacfbnkolflbankfiackpcnmckl?label=Chrome%20Web%20Store&logo=googlechrome&logoColor=white&color=4285F4)](https://chromewebstore.google.com/detail/ati-auxiliar-de-atendimen/mlgmmjacfbnkolflbankfiackpcnmckl)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/mlgmmjacfbnkolflbankfiackpcnmckl?color=34A853&label=Users)](https://chromewebstore.google.com/detail/ati-auxiliar-de-atendimen/mlgmmjacfbnkolflbankfiackpcnmckl)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)

[🔧 Admin Panel](https://vituali.github.io/ATI) · [📦 Chrome Web Store](https://chromewebstore.google.com/detail/ati-auxiliar-de-atendimen/mlgmmjacfbnkolflbankfiackpcnmckl) · [📋 Changelog](#-changelog)

</div>

---

## 📸 Screenshots

<div align="center">

| Sidebar with Quick Replies & Buttons | Create Service Order Modal |
|---|---|
| ![ATI sidebar with action buttons and categorized quick replies injected into ChatMix](docs/screenshot-sidebar.png) | ![Create Service Order modal with contract Online status, occurrence type and templates](docs/screenshot-modal.png) |

</div>

---

## ✨ Features

### 🔘 ChatMix Sidebar Buttons
| Button | Description |
|--------|-------------|
| 👤 **Contact** | Copies formatted name and phone number |
| 🤖 **Chat** | Generates a clean AI prompt from the chat history |
| 📄 **CPF** | Copies the CPF/CNPJ detected in the messages |
| 📝 **O.S** | Opens the service order creation modal |
| 🔄 **Refresh** | Clears cache and reloads client data |
| ↗️ **SGP** | Opens the client's profile directly in SGP |

### 📝 Service Order Modal
- Contract selection with **real-time Online/Offline status**
- Occurrence type selector with search
- Per-agent O.S templates
- Automatic form fill in SGP
- **Auto-draft** — saves text as you type and restores on reopen
- Automatically cleared when the attendance is closed

### ⚡ Quick Replies
- Categorized quick replies injected above the message input
- Two-level navigation: categories → replies
- One-click insert into the text field
- In-memory cache — **single Firebase read per session**

### 🤖 AI Prompt Generator
- Clean history: strips automation messages, transfers and bot menus
- Identifies client vs agent messages from the DOM
- Ready to paste into ChatGPT, Claude or any AI

### 🔐 Authentication
- Firebase-backed per-agent login
- Session persisted in `chrome.storage.local`
- Access control by status (`active` / blocked)

---

## 🏗️ Architecture

```
src/
├── background/                  # Service Worker (network & CORS logic)
│   ├── index.ts                 # Entry point — message listener
│   ├── firebase.ts              # Auth, templates and quick replies
│   └── sgp/
│       ├── constants.ts         # URLs, TTLs and interfaces
│       ├── cache.ts             # Form cache (max 50 entries)
│       ├── auth.ts              # SGP login with session cache
│       ├── search.ts            # Client search (CPF, name, phone)
│       ├── contracts.ts         # Contracts + online/offline status
│       └── occurrence.ts        # Forms, occurrences and tab management
│
├── contentScript/
│   ├── chatmix/
│   │   ├── index.ts             # Entry point — buttons, observer, init
│   │   ├── state.ts             # Global state, selectors, debug
│   │   ├── helpers.ts           # CPF/CNPJ, formatting, setNativeValue
│   │   ├── getClientData.ts     # DOM data extraction
│   │   ├── buildAIPrompt.ts     # AI prompt generator
│   │   ├── Quickreply.ts        # Quick replies with in-memory cache
│   │   ├── style.css
│   │   ├── auth/
│   │   │   ├── firebase.ts
│   │   │   ├── session.ts
│   │   │   ├── login.ts
│   │   │   ├── loginModal.ts
│   │   │   └── login.css
│   │   └── os/
│   │       ├── osModal.ts       # Full service order modal
│   │       ├── osDraft.ts       # Per-chat draft in sessionStorage
│   │       └── osModal.css
│   └── sgp/
│       ├── actions.ts
│       ├── fillForm.ts
│       ├── sgpFill.js
│       └── types.ts
│
├── popup/
│   ├── Popup.html
│   ├── Popup.tsx
│   ├── Popup.css
│   └── main.tsx
│
├── assets/
│   └── logo.png
│
├── global.d.ts
└── manifest.ts
```

---

## 🛠️ Tech Stack

- **React 18** + **TypeScript** — Popup UI
- **Vite** — Manifest V3 build pipeline
- **Firebase Realtime Database** — Templates, quick replies and auth
- **Chrome Extensions API** — Storage, Tabs, SidePanel
- **MutationObserver** with debounce — Attendance change detection

---

## 🚀 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/Vituali/Chrome-Extension-ATI-V2.git
cd Chrome-Extension-ATI-V2
npm install
```

### Build

```bash
# Development build with watch
npm run build -- --watch

# Production build
npm run build

# Build and package for Chrome Web Store submission
npm run zip
```

### Load in Chrome

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `dist/` folder

---

## ⚙️ Configuration

The admin panel is available at **[vituali.github.io/ATI](https://vituali.github.io/ATI)**, where administrators can:

- 👥 Manage agents (create, block, assign roles)
- 📋 Create and edit **O.S templates** per agent
- ⚡ Create and edit **quick replies** with categories and subcategories

### Firebase Structure

```
admins/{uid}                     → true
atendentes/{username}            → { email, nomeCompleto, role, uid, status }
modelos_os/{username}/{id}       → { id, title, text, category, occurrenceTypeId }
respostas/{username}/[]          → { category, subCategory, text, title }
```

---

## 📋 Changelog

### v2.0.5-beta

- ✅ Cores de Status nos contratos (Ativo, Vel. Red., Suspenso, etc)
- ✅ Design System padronizado com transparências rgba e estados de :hover
- ✅ Resumo de Status e contador no modal de seleção de clientes
- ✅ osModal desmembrado em submódulos (UI, SGP, Handlers, Types)
- ✅ Zero any no firebase.ts e cache.ts com interfaces TypeScript estritas
- ✅ Refresh status online específico sem recarregar todo o formulário SGP
- ✅ ExtensionRequest padronizado para todas as mensagens Background/Content
- ✅ botPatterns isolado para limpeza de histórico de chat
- ✅ CLAUDE.md blindado com regras de nomenclatura para IAs

### v2.0.4
- ✅ **Online/Offline** status for contracts in the O.S modal
- ✅ Background refactored into modules (`firebase`, `sgp/auth`, `sgp/contracts`, etc.)
- ✅ Auto-draft per attendance in `sessionStorage`
- ✅ Quick reply in-memory cache — single Firebase read per session
- ✅ MutationObserver debounce — Vue virtual scroller compatibility
- ✅ Guards against simultaneous inits and duplicate loads
- ✅ SGP form cache capped at 50 entries
- ✅ `AbortSignal.timeout` on all SGP fetches
- ✅ AI prompt with clean history (strips automation/transfers)
- ✅ Toggle switches in the O.S modal

### v2.0.0
- 🎉 Full rewrite — React + TypeScript + Manifest V3
- 🔐 Firebase-backed per-agent login system
- 📝 O.S modal with automatic SGP form fill
- ⚡ Categorized quick replies
- 🤖 Automatic attendance change detection

---

## 👤 Author

Built by **Vituali** for internal use at **ATI Internet**.

---

<div align="center">
<sub>Available on the <a href="https://chromewebstore.google.com/detail/ati-auxiliar-de-atendimen/mlgmmjacfbnkolflbankfiackpcnmckl">Chrome Web Store</a></sub>
</div>
