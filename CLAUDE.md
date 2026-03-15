# Documentação do Projeto — Extensão ATI V2

## 🎯 Objetivo do Projeto

Uma extensão para Google Chrome criada para integrar o sistema de chat de atendimento (**ChatMix**) com o Sistema de Gestão de Provedores (**SGP**). A extensão automatiza processos repetitivos para os atendentes, como inserção de respostas rápidas e, principalmente, a criação de Ordens de Serviço (O.S.) cruzando dados do cliente entre as duas plataformas.

## 🛠️ Stack Tecnológico

- **Linguagem**: TypeScript
- **Build Tool**: Vite com plugin CRXJS (`@crxjs/vite-plugin`) para manifest V3.
- **Banco de Dados/Backend**: Firebase Realtime Database (Acessado via REST API, sem SDK pesado).
- **Estilização**: CSS puro injetado via content scripts.

## 🔄 Fluxo de Dados da Extensão

1. Content Script observa mudanças no DOM do ChatMix.
2. Ao detectar um cliente ou ação relevante, extrai CPF/CNPJ ou nome.
3. Envia requisição ao Background via `chrome.runtime.sendMessage`.
4. O Background consulta:
   - SGP (usando cookies do navegador)
   - Firebase (templates e respostas)
5. O Background retorna os dados ao Content Script.
6. O Content Script renderiza UI ou injeta texto no ChatMix.

## 📂 Arquitetura de Pastas

O projeto segue a separação estrita exigida pelo Manifest V3 do Chrome:

- `src/background/`: **Service Worker**. Roda isolado em background.
  - Único lugar permitido para fazer requisições externas críticas (SGP e Firebase) para evitar bloqueios de CORS.
  - `sgp/`: Lógica de extração e submissão silenciosa ('scraping' via endpoints internos) para o site do SGP.
  - `firebase.ts`: Comunicação (Auth e Database via REST) com o Firebase.
- `src/contentScript/`: **Scripts injetados na página do ChatMix** (`chatmix.com.br`).
  - Lida exclusivamente com manipulação do DOM e UI da extensão.
  - `chatmix/`: Módulos específicos para atuar no ChatMix (observadores de DOM, injeção de botões).
  - `chatmix/os/`: Contém a lógica do Modal de O.S. (recentemente modularizado em `osModal.ts`, `osModalSgp.ts`, `osModalUI.ts`, `osModalHandlers.ts`, `osModalTypes.ts`).
  - `chatmix/auth/`: Lida com banners de login do Firebase sobrepostos ao ChatMix.
- `src/popup/`: Interface HTML do ícone da extensão (caso necessário).

## ⚠️ Regra Arquitetural Fundamental

O Content Script nunca deve acessar diretamente:

- SGP
- Firebase
- APIs externas

Toda comunicação externa deve passar pelo Background Service Worker.

## 🧠 Regras de Negócio Críticas

### 1. Autenticação SGP (Cookies)

A extensão **não** guarda senhas do SGP. Ela se aproveita do fato de o atendente já estar logado no SGP em outra aba do navegador.

- As requisições em `background/sgp` usam `fetch` com `credentials: 'include'`.
- Isso envia os cookies da sessão ativa do usuário para o SGP silenciosamente.

### 2. SGP Cache Policy (Prevenção de Rate Limit)

Para evitar que a ATI seja bloqueada pelo SGP devido a múltiplas buscas automáticas:

- **Regra**: O estado e dados de formulário do SGP (contratos do cliente, status online/offline, tipos de ocorrência) devem ser gerados **uma vez por cliente/chat**.
- A extensão usa o `chatId` (ID da URL do ChatMix) como chave de cache principal.
- O cache do SGP (`clearSgpCache`) **só deve ser limpo** quando:
  1. O atendente gera a O.S. ("Preencher no SGP" ou "Copiar").
  2. O atendente clica no botão "Encerrar atendimento" no ChatMix.
  3. A URL do chat muda drasticamente (mudança de sessão).

### 3. Comunicação Content Script ↔ Background

- O `contentScript` **nunca** faz requisições diretas ao SGP ou Firebase (evita CORS e garante segurança de contexto).
- Usa-se `chrome.runtime.sendMessage` com interfaces padronizadas (ver `src/background/types.ts`).
- Exemplo: Content Script descobre o CPF no ChatMix → Pede ao Background `getSgpFormParams` → Background faz a busca no SGP com cookies cruzados → Retorna JSON para o Content Script renderizar o Modal.

### 4. Firebase (Templates e Respostas)

- O `idToken` do Firebase tem validade (1 hora).
- Respostas rápidas e Templates de O.S. (`modelos_os`, `respostas`) são cacheados em memória no service worker no início do plantão para máxima performance.
- O Content script deve enviar o `chatId` e context data para o background hidratar os _placeholders_ dinâmicos (`[SAUDACAO]`, `[HOJE]`) antes de jogar no DOM.

## 📝 Regras de Código e Boas Práticas (Para IAs)

1. **Sem tipo `any`**: O projeto utiliza TypeScript estrito. Se for criar código novo, declare e exporte as `Interfaces` apropriadas no respectivo arquivo `types.ts`.
2. **Modularização do UI**: Arquivos que manipulam o DOM (`contentScript`) devem ser mantidos curtos e focados. Se um arquivo passar de 200-300 linhas (como era o `osModal.ts`), ele deve ser dividido em módulos lógicos (ex: `arquitetura_ui`, `arquitetura_api`, `arquitetura_eventos`).
3. **Gerenciamento de Listeners**: Modais criados via ejetamento no DOM (`document.createElement`) que anexam eventos no `document` ou `body` **sempre** devem usar um `AbortController` (passando o `signal`) que é abortado quando o modal é destruído, evitando memory leaks.
4. **Tratamento Seguro de HTML (XSS)**: Sempre que receber textos do Firebase ou do SGP para renderizar no ChatMix (via `.innerHTML`), garanta que o dado interno (`text`) passe por uma função de `escape` ou seja inserido via `.textContent` para evitar XSS.

## 🗄️ Integração com Banco de Dados

Sempre consulte o arquivo `FIREBASE_SCHEMA.md` na raiz deste repositório para entender a estrutura em JSON da base de dados e as regras de segurança aplicáveis.

## 🕷️ Pontos de Falha Críticos (Dependência do DOM do ChatMix)

A extensão dependende fortemente do HTML da página do ChatMix. Qualquer atualização no frontend deles pode quebrar a extensão.

1. **Seletores CSS (`src/contentScript/chatmix/state.ts`)**: É ali que está o mapa do tesouro (ex: `#actionsContainerV2`, `.flex-none.p-4`). Se os botões ou o campo de texto (textarea) sumirem, o problema está nos seletores. Aja sempre atualizando-os.
2. **Mutation Observers (`index.ts`)**: A extensão usa um `MutationObserver` para varrer alterações na tela e reinjetar os botões (O.S e Copy) toda vez que a URL ou o painel do chat muda.
3. **Extração de Dados (`getClientData.ts` e `tryVisualIdentification.ts`)**: A extensão raspa o CPF/CNPJ ou Nome do cliente lendo o texto lateral ou o histórico do chat usando **Regex**. Novamente, uma mudança no layout ou formatação do texto no ChatMix vai requerer ajuste nas Regex nesses arquivos.
