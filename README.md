# NEXUS CONTROL

NEXUS CONTROL is a local Playwright-driven gateway that operates consumer LLM web frontends such as ChatGPT, Claude, Gemini, and Grok, then exposes them through:

- a browser-based control dashboard
- per-provider streaming endpoints
- OpenAI-compatible chat endpoints
- Ollama-compatible generate/chat endpoints

The project is designed for cases where you want to reuse real logged-in browser sessions instead of official APIs.

## What It Does

- Opens real provider websites in persistent Playwright browser profiles
- Saves login state per account/profile so sessions survive restarts
- Sends prompts through the actual frontend UI
- Reads responses back from the DOM and streams them to the app
- Supports multiple accounts per provider with quota-aware rotation
- Exposes a mission-control dashboard with parallel compare view
- Includes a Grok read-aloud audio capture flow
- Ships with an English/Italian frontend language switch

## Architecture

```text
Dashboard / API client
        |
        v
   Fastify server
        |
        v
 FrontendGateway
        |
        +--> AccountManager
        |      |
        |      +--> active account per provider
        |      +--> quota state
        |
        +--> SessionManager
        |      |
        |      +--> persistent Chrome profile per account
        |      +--> shared or isolated contexts
        |
        +--> Playwright page
               |
               v
        ChatGPT / Claude / Gemini / Grok web UI
```

## Current Model

The codebase no longer assumes one profile per provider.

It now uses:

- `accounts.config.json` as the source of truth for provider accounts
- one persistent Chrome profile per configured `profileDir`
- optional shared profiles such as `_shared`
- automatic session reopening on boot when a persisted profile already exists
- automatic account rotation when a provider response looks quota-exhausted

## Setup

```bash
cp .env.example .env
cp providers.config.example.json providers.config.json
cp accounts.config.example.json accounts.config.json
npm install
npm run playwright:install
```

By default the server starts on `http://localhost:3001`.

## Running the App

Recommended:

```bash
./run-dev.sh
```

This script:

- stops an older dev/watch process if one is still running
- frees port `3001` when possible
- starts the Fastify + Playwright dev server again

Equivalent npm command:

```bash
npm run dev:restart
```

If you do not want the automatic cleanup step, use the plain watcher:

```bash
npm run dev
```

Production-style launch:

```bash
npm run build
npm start
```

## Session Persistence and Migration

Saved logins are not stored in environment variables.

They live inside the persistent Playwright browser profiles under:

```text
.playwright/profiles/
```

That directory contains the real browser session data:

- cookies
- local storage
- session storage
- IndexedDB
- OAuth state

If you move to another machine, cloning the repository alone is not enough. You must also carry over:

- `.playwright/`
- `accounts.config.json`
- `providers.config.json`
- `.env`

### Backup Current State

Recommended:

```bash
./backup-state.sh
```

Equivalent npm command:

```bash
npm run backup:state
```

This creates a portable `tar.gz` archive containing the app state needed to preserve sessions.

### Restore on Another Machine

1. Clone the repo
2. Install dependencies
3. Copy the backup archive onto the new machine
4. Restore it:

```bash
./restore-state.sh /path/to/nexgate-state-YYYYMMDD-HHMMSS.tar.gz
```

Equivalent npm command:

```bash
npm run restore:state -- /path/to/nexgate-state-YYYYMMDD-HHMMSS.tar.gz
```

Then start the app again with:

```bash
./run-dev.sh
```

Notes:

- restore works best when the same Chrome/Playwright major version is available
- some providers may still ask for a fresh challenge after a machine change
- never commit `.playwright` or `.env` to git

## First Login

1. Open `http://localhost:3001`
2. Click `LOGIN` for the providers you want
3. Complete the login in the Playwright browser window
4. Click `CHECK`

The resulting cookies, local storage, IndexedDB, and OAuth state are stored inside the profile directory configured for the active account.

On later restarts, the app attempts silent auto-login for providers whose profiles already exist.

## Dashboard

The dashboard lives at `http://localhost:3001/`.

Main areas:

- `Provider Sessions`
  - real-time status per provider
  - login / check / reset actions
  - quota and account state visibility
- `Prompt Lab`
  - one shared prompt sent to multiple providers
  - provider selection
  - keyboard shortcut support
- `Compare View`
  - parallel streaming cards
  - per-provider latency
  - incremental UI updates as responses arrive
- `ITA / ENG`
  - frontend language switch in the top bar

## Keyboard Shortcuts

| Key | Action |
| --- | --- |
| `Ctrl+Enter` | Run compare |
| `R` | Refresh provider state |
| `1` to `4` | Toggle providers |
| `?` | Open shortcut overlay |
| `Esc` | Close overlay |

## Accounts

Accounts are configured in `accounts.config.json`.

Example:

```json
{
  "chatgpt": [
    { "email": "primary@gmail.com", "profileDir": "_shared" },
    { "email": "backup@gmail.com", "profileDir": "chatgpt-backup-1" }
  ]
}
```

Notes:

- `profileDir` is resolved under `.playwright/profiles/<namespace>/`
- multiple providers can share the same `profileDir`
- backup accounts can use separate profiles
- quota flags are tracked in memory and can be reset from the app

## Provider Configuration

Provider selectors live in `providers.config.json`.

That file controls:

- login URL
- base URL
- ready selectors
- input selector
- submit selector
- message selectors
- busy selectors

The default selectors are only a starting point. These websites change often, so this file is expected to evolve.

## HTTP API

### Health and Overview

```text
GET  /health
GET  /providers
GET  /providers/overview
GET  /accounts
```

### Provider Session Endpoints

```text
POST /providers/:provider/login
GET  /providers/:provider/status
POST /providers/:provider/reset
POST /providers/:provider/prompt
POST /providers/:provider/stream
POST /providers/:provider/audio
GET  /providers/:provider/audio/latest
```

### Account Management Endpoints

```text
POST /accounts/:provider
POST /providers/:provider/accounts/rotate
POST /providers/:provider/accounts/reset-quota
```

### Compare Endpoints

```text
POST /compare
POST /compare/stream
```

`/compare/stream` returns NDJSON so the UI can render provider results progressively.

### OpenAI-Compatible API

```bash
curl http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "chatgpt:frontend-default",
    "messages": [
      { "role": "user", "content": "Write a haiku about debugging" }
    ]
  }'
```

Streaming:

```bash
curl http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{
    "model": "claude:frontend-default",
    "stream": true,
    "messages": [
      { "role": "user", "content": "Summarize CQRS in 5 bullets" }
    ]
  }'
```

### Ollama-Compatible API

Generate:

```bash
curl http://localhost:3001/api/generate \
  -H 'content-type: application/json' \
  -d '{
    "model": "gemini:frontend-default",
    "prompt": "Explain the adapter pattern",
    "stream": false
  }'
```

Chat:

```bash
curl http://localhost:3001/api/chat \
  -H 'content-type: application/json' \
  -d '{
    "model": "grok:frontend-default",
    "messages": [
      { "role": "user", "content": "Give me 3 side-project ideas" }
    ]
  }'
```

### Grok Audio

Grok supports a read-aloud capture flow through:

```text
POST /providers/grok/audio
GET  /providers/grok/audio/latest
```

Typical flow:

1. Generate a Grok response in the frontend
2. Trigger audio capture
3. Load the cached audio URL into a player

## Project Structure

```text
src/
  index.ts
  server.ts
  gateway.ts
  accounts.ts
  errors.ts
  config.ts
  browser/
    session-manager.ts
  providers/
    generic-provider.ts
    registry.ts
public/
  index.html
  app.js
  styles.css
providers.config.json
accounts.config.json
```

## Limitations

- Provider DOMs are unstable and can break selectors at any time
- Some providers show CAPTCHA, Cloudflare, age checks, or temporary challenge pages
- Response extraction is still DOM-driven, so cleanliness depends on per-provider readers and sanitizers
- Frontend model selection is not fully automated inside every provider UI
- Audio capture currently targets Grok specifically

## Operational Notes

- Use `RESET` if a provider tab or session becomes corrupted
- If a provider is logged in but not recognized as ready, update selectors in `providers.config.json`
- If quota rotation is enabled, the active account may change automatically after a rate-limit response
- Auto-login at boot only works when a persisted profile already exists

## Legal / Terms

You are automating consumer web frontends. Make sure your usage complies with the terms of service, rate limits, and account policies of each provider.
