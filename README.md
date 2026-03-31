# NEXUS CONTROL — Frontend LLM Gateway

Gateway locale che pilota ChatGPT, Claude, Gemini e Grok via Playwright, esponendo una dashboard real-time e API compatibili OpenAI/Ollama. Zero credenziali da gestire: il login avviene una sola volta nel browser aperto da Playwright, il profilo viene persistito.

## Come funziona

```
Dashboard / Client
       │
       ▼
  Fastify server  ──►  Playwright page  ──►  Provider web UI
       ▲                                            │
       └────────────── SSE token stream ────────────┘
```

Ogni provider gira in un profilo Chrome persistente. Dopo il primo login manuale, i restart successivi non richiedono nuova autenticazione. I prompt vengono inviati digitando nella textarea del sito reale; le risposte vengono lette dal DOM in streaming.

## Setup

```bash
cp .env.example .env
cp providers.config.example.json providers.config.json
npm install
npm run playwright:install
npm run dev
```

Server su `http://localhost:3001`.

### Primo login

Apri `http://localhost:3001`, clicca **Apri Login** per ogni provider e completa il login nella finestra Playwright che si apre. Da quel momento il profilo è salvato in `.playwright/profiles/chrome-stable/<provider>` e non serve rifare il login.

Se una sessione si corrompe, usa **Reset** dalla sidebar e riapri il login.

## Dashboard NEXUS CONTROL

Interfaccia "Mission Control" accessibile su `http://localhost:3001`.

### Funzionalità

- **Provider Sessions** (sidebar) — stato in tempo reale con anelli SVG animati
  - Verde pulsante = pronto
  - Ambra rotante = elaborazione in corso
  - Rosso lampeggiante = errore
  - Grigio = sessione non aperta
- **Prompt Lab** — scrivi un prompt, seleziona i provider, premi CONFRONTA
- **Compare View** — le risposte arrivano in parallelo via SSE, una card per provider con badge latenza

### Scorciatoie da tastiera

| Tasto | Azione |
|-------|--------|
| `Ctrl+Enter` | Avvia confronto |
| `R` | Aggiorna stato provider |
| `1` – `4` | Toggle provider 1–4 |
| `?` | Mostra scorciatoie |
| `Esc` | Chiudi overlay |

## API

### OpenAI-compatible

```bash
# Non-streaming
curl http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"claude:frontend-default","messages":[{"role":"user","content":"Ciao"}]}'

# Streaming SSE
curl http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"chatgpt:frontend-default","stream":true,"messages":[{"role":"user","content":"Haiku sul debugging"}]}'
```

### Ollama-compatible

```bash
# Generate
curl http://localhost:3001/api/generate \
  -H 'content-type: application/json' \
  -d '{"model":"gemini:frontend-default","prompt":"Cos è un adapter pattern","stream":false}'

# Chat
curl http://localhost:3001/api/chat \
  -H 'content-type: application/json' \
  -d '{"model":"grok:frontend-default","messages":[{"role":"user","content":"3 idee side project"}]}'
```

### Provider stream (SSE per la dashboard)

```
POST /providers/:provider/stream
Body: { "prompt": "..." }
```

Eventi SSE:
- `{"type":"token","delta":"..."}` — chunk di testo incrementale
- `{"type":"done","text":"..."}` — risposta completa
- `{"type":"error","code":"...","message":"..."}` — errore

### Compare (NDJSON)

```bash
curl http://localhost:3001/compare/stream \
  -H 'content-type: application/json' \
  -d '{"prompt":"Vantaggi di Rust per backend","providers":["chatgpt","claude","gemini","grok"]}'
```

### Gestione provider

```
GET  /providers                        # lista provider e stato
POST /providers/:provider/login        # apri browser per login
GET  /providers/:provider/status       # stato dettagliato
POST /providers/:provider/reset        # chiudi sessione
POST /providers/:provider/audio        # cattura audio read-aloud
```

## Strategia conversazione

Il gateway **continua la stessa conversazione** tra prompt consecutivi. Una nuova chat viene aperta solo quando il contesto supera ~40 messaggi. Questo elimina i reload di pagina tra prompt e previene gli errori di elemento staccato dal DOM che si verificano durante le navigazioni mid-session.

## Note per provider

| Provider | Note |
|----------|------|
| **ChatGPT** | URL conversazione (`/c/UUID`) preservato tra prompt |
| **Claude** | Risposta rilevata via attributo `data-is-streaming`; la pagina non ha tag `<main>` |
| **Gemini** | Streaming via polling DOM su `.response-content` |
| **Grok** | Usa `readLastVisibleText` come strategia di estrazione risposta |

## Struttura progetto

```
src/
  server.ts               # Route Fastify
  gateway.ts              # Orchestratore FrontendGateway
  providers/
    generic-provider.ts   # Logica automazione Playwright
    registry.ts           # Registry provider
  browser/
    session-manager.ts    # Gestione profili persistenti
  types.ts
  utils.ts
public/
  index.html              # UI NEXUS CONTROL
  app.js                  # JS frontend (SSE streaming, stato, toast)
  styles.css              # Tema dark Mission Control
providers.config.json     # Selettori e configurazione provider
```

## Limiti

- I frontend LLM cambiano spesso DOM e selettori — aggiorna `providers.config.json` se un provider smette di rispondere
- La selezione del modello dentro il sito non è automatizzata: il campo `model` serve per routing
- Alcuni provider possono mostrare captcha o challenge manuali — completali nella finestra Playwright
- Rispetta i termini di servizio di ogni provider
