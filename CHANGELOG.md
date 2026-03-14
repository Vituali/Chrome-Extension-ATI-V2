# CHANGELOG

```txt
Summary
  1. document grouping follow 'SemVer2.0' protocol
  2. use 'PATCH' as a minimum granularity
  3. use concise descriptions
  4. type: feat \ fix \ update \ perf \ remove \ docs \ chore
  5. version timestamp follow the yyyy.MM.dd format
```

## 2.0.5 [2026.03.13]

### 🔥 Novidades & Refatoração (Major Update)
- **Refatoração do Modal de O.S**: O antigo arquivo gigante `osModal.ts` foi completamente desmembrado em diversos módulos menores (`osModal.ts`, `osModalUI.ts`, `osModalSgp.ts`, `osModalHandlers.ts`, `osModalTypes.ts`). Manutenção e detecção de bugs muito mais ágil.
- **Prevenção de Memory Leaks**: Implementado o padrão de `AbortController` em todos modais injetados na tela. Quando um modal é fechado, todos os event listeners daquele modal anexados no documento são destruídos instantaneamente.
- **SGP Caching System (Anti-Rate Limit)**: A busca por dados do cliente no SGP ocorre **apenas uma vez por cliente** baseado na URL do chat (`chatId`). O recarregamento contínuo das rotas do SGP foi encerrado, reduzindo chamadas silenciosas e prevenindo bloqueios do provedor.
- Limpeza automática de cache residual do SGP ao finalizar os atendimentos via clique no botão "Encerrar atendimento" no ChatMix.

### 🐛 Correções de Bugs
- **Case-sensitivity no Build**: O arquivo corrompido ou referenciado erroneamente como `Quickreply` foi padronizado em todo o projeto para `quickReply.ts`, previnindo falhas severas de carregamento em sistemas de pacote que diferenciam maiúsculas (Vite/Linux).
- Correção de dupla importação de Tipos de Domínio TypeScript.

## 0.0.0 [2026.03.10]

- feat: initial
- feat: generator by ![create-chrome-ext](https://github.com/guocaoyi/create-chrome-ext)
