/* ═══════════════════════════════════════════
   NEXUS CONTROL — app.js
   Real-time per-provider parallel SSE streaming
   ═══════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────
const state = {
  providers: [],
  selectedProviders: new Set(loadSelectedProviders()),
  // Map<providerId, { text, ok, error, latencyMs, startTime, working, controller }>
  results: new Map(),
  comparing: false,
  maxLatencyMs: 1,
};

function loadSelectedProviders() {
  try {
    const raw = localStorage.getItem("nexus_selected");
    if (!raw) return ["chatgpt", "claude", "gemini", "grok"];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : ["chatgpt", "claude", "gemini", "grok"];
  } catch {
    return ["chatgpt", "claude", "gemini", "grok"];
  }
}

function saveSelectedProviders() {
  localStorage.setItem("nexus_selected", JSON.stringify([...state.selectedProviders]));
}

// ── DOM refs ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const el = {
  providersList:  $("providers-list"),
  providerPicker: $("provider-picker"),
  promptInput:    $("prompt-input"),
  runBtn:         $("run-compare"),
  compareStatus:  $("compare-status"),
  compareMeta:    $("compare-meta"),
  resultsGrid:    $("results-grid"),
  globalError:    $("global-error"),
  refreshBtn:     $("refresh-status"),
  helpBtn:        $("help-btn"),
  helpOverlay:    $("help-overlay"),
  helpClose:      $("help-close"),
  statReady:      $("stat-ready"),
  statLaunched:   $("stat-launched"),
  statTime:       $("stat-time"),
  toasts:         $("toasts"),
};

// ── API helper ─────────────────────────────────────────────
async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    ...options,
  });
  const ct = res.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text();

  if (!res.ok) {
    const err = new Error(
      (payload && typeof payload === "object" ? payload.detail ?? payload.message : payload) || `HTTP ${res.status}`
    );
    err.ui = payload;
    throw err;
  }
  return payload;
}

// ── Toast notifications ────────────────────────────────────
function toast(text, type = "ok", durationMs = 3500) {
  const node = document.createElement("div");
  node.className = `toast ${type}`;
  node.innerHTML = `<div class="toast-dot"></div><div class="toast-text">${escHtml(text)}</div>`;
  el.toasts.appendChild(node);

  const remove = () => {
    node.classList.add("leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  };

  const timer = setTimeout(remove, durationMs);
  node.addEventListener("click", () => { clearTimeout(timer); remove(); });
}

// ── Status ring helpers ────────────────────────────────────
function providerStateClass(status) {
  if (!status) return "is-waiting";
  if (status.quotaState === "exhausted") return "is-quota";
  if (status.ready) return "is-ready";
  if (status.error) return "is-error";
  if (status.launched) return "is-working";
  return "is-waiting";
}

function providerStatusLabel(status) {
  if (!status) return "non init";
  if (status.quotaState === "exhausted") return "QUOTA";
  if (status.ready) return "READY";
  if (status.error) return status.code ?? "ERROR";
  if (status.launched) return "OPEN";
  return status.persisted ? "SAVED" : "IDLE";
}

function makeRingInitials(id) {
  const map = { chatgpt: "CG", claude: "CL", gemini: "GM", grok: "GK" };
  return map[id] ?? id.slice(0, 2).toUpperCase();
}

// ── Render sidebar provider items ──────────────────────────
function renderSidebar() {
  el.providersList.innerHTML = "";
  el.providerPicker.innerHTML = "";

  let nReady = 0;
  let nLaunched = 0;

  for (const p of state.providers) {
    const stClass = providerStateClass(p.status);
    const label   = providerStatusLabel(p.status);
    const url     = p.status?.url ?? p.baseUrl;
    const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/.*/, "");

    if (p.status?.ready) nReady++;
    if (p.status?.launched) nLaunched++;

    // Active account info
    const activeAccount = (p.accounts ?? []).find((a) => a.active);
    const email = activeAccount?.email ?? p.status?.account ?? "";
    const showEmail = email && email !== "unknown";
    const hasBackup = (p.accounts ?? []).some((a) => !a.active && a.quotaState !== "exhausted");
    const isQuota = stClass === "is-quota";

    // ── sidebar card
    const item = document.createElement("div");
    item.className = `provider-item ${stClass}`;
    item.dataset.provider = p.id;
    item.innerHTML = `
      <div class="provider-item-head">
        <div class="ring-wrap ${stClass}">
          <svg class="ring-svg" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <circle cx="17" cy="17" r="13" class="ring-track"/>
            <circle cx="17" cy="17" r="13" class="ring-arc"/>
          </svg>
          <div class="ring-label ${stClass}">${makeRingInitials(p.id)}</div>
        </div>
        <div class="provider-item-info">
          <div class="provider-item-name">${escHtml(p.label)}</div>
          <div class="provider-item-status ${stClass}">${label}</div>
          ${showEmail ? `<div class="provider-item-account">${escHtml(email)}</div>` : ""}
        </div>
      </div>
      <div class="provider-item-url">${escHtml(shortUrl)}</div>
      <div class="provider-item-actions">
        <button class="item-btn btn-login" data-action="login" data-provider="${p.id}">LOGIN</button>
        <button class="item-btn btn-verify" data-action="verify" data-provider="${p.id}">CHECK</button>
        <button class="item-btn btn-reset" data-action="reset" data-provider="${p.id}">RESET</button>
        ${isQuota && hasBackup ? `<button class="item-btn btn-rotate" data-action="rotate" data-provider="${p.id}">ROTATE</button>` : ""}
        ${isQuota && !hasBackup ? `<button class="item-btn btn-reset-quota" data-action="reset-quota" data-provider="${p.id}">SBLOCCA</button>` : ""}
      </div>
    `;
    el.providersList.appendChild(item);

    // ── picker chip
    const chip = document.createElement("label");
    chip.className = "picker-chip";
    chip.innerHTML = `
      <input type="checkbox" value="${p.id}" ${state.selectedProviders.has(p.id) ? "checked" : ""}/>
      <span class="chip-dot"></span>
      <span>${p.label}</span>
    `;
    chip.querySelector("input").addEventListener("change", (e) => {
      if (e.target.checked) state.selectedProviders.add(p.id);
      else state.selectedProviders.delete(p.id);
      saveSelectedProviders();
    });
    el.providerPicker.appendChild(chip);
  }

  // Update topbar stats
  el.statReady.textContent   = `${nReady} READY`;
  el.statLaunched.textContent = `${nLaunched} OPEN`;
  el.statReady.classList.toggle("alive", nReady > 0);
  el.statLaunched.classList.toggle("alive", nLaunched > 0);

  // Bind action buttons
  el.providersList.querySelectorAll(".item-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleProviderAction(btn));
  });
}

// ── Provider action buttons ────────────────────────────────
async function handleProviderAction(btn) {
  const action   = btn.dataset.action;
  const provider = btn.dataset.provider;

  // Disable all buttons in this card while running
  const card = btn.closest(".provider-item");
  card.querySelectorAll(".item-btn").forEach((b) => { b.disabled = true; });
  showGlobalError(null);

  try {
    if (action === "login") {
      setStatus(`Apro ${provider} nel browser Playwright. Completa il login, poi clicca CHECK.`, "busy");
      await api(`/providers/${provider}/login`, { method: "POST", body: "{}" });
      toast(`${provider}: browser aperto`, "ok");
    } else if (action === "verify") {
      const status = await api(`/providers/${provider}/status`);
      const target = state.providers.find((p) => p.id === provider);
      if (target) { target.status = status; renderSidebar(); }
      setStatus(status.ready ? `${provider} pronto.` : `${provider} non pronto. ${status.hint ?? ""}`, status.ready ? "done" : "busy");
      toast(status.ready ? `${provider}: pronto` : `${provider}: ${status.code ?? "non pronto"}`, status.ready ? "ok" : "warn");
    } else if (action === "reset") {
      await api(`/providers/${provider}/reset`, { method: "POST", body: "{}" });
      const target = state.providers.find((p) => p.id === provider);
      if (target) { target.status = { provider, ready: false, launched: false }; renderSidebar(); }
      setStatus(`${provider} resettato.`);
      toast(`${provider}: resettato`, "warn");
    } else if (action === "rotate") {
      const result = await api(`/providers/${provider}/accounts/rotate`, { method: "POST", body: "{}" });
      if (result.rotated) {
        toast(`${provider}: rotazione → ${result.active.email}`, "ok");
      } else {
        toast(`${provider}: tutti gli account hanno quota esaurita`, "err");
      }
      await loadOverview();
    } else if (action === "reset-quota") {
      await api(`/providers/${provider}/accounts/reset-quota`, { method: "POST", body: "{}" });
      toast(`${provider}: quota resettata`, "ok");
      await loadOverview();
    }
  } catch (err) {
    const payload = err.ui ?? { title: `Errore ${provider}`, detail: err.message };
    showGlobalError(payload);
    toast(`${provider}: ${payload.detail ?? payload.title}`, "err");
  } finally {
    card.querySelectorAll(".item-btn").forEach((b) => { b.disabled = false; });
  }
}

// ── Load providers overview ────────────────────────────────
async function loadOverview() {
  el.refreshBtn.classList.add("spinning");
  try {
    state.providers = await api("/providers/overview");
    renderSidebar();
    showGlobalError(null);
  } catch (err) {
    showGlobalError(err.ui ?? { title: "Errore caricamento", detail: err.message });
    toast("Errore caricamento provider", "err");
  } finally {
    el.refreshBtn.classList.remove("spinning");
  }
}

// ── Compare: parallel per-provider SSE streaming ──────────
async function runCompare() {
  const prompt    = el.promptInput.value.trim();
  const providers = [...state.selectedProviders];

  if (!prompt) { setStatus("Inserisci un prompt prima di avviare."); return; }
  if (!providers.length) { setStatus("Seleziona almeno un provider."); return; }

  // Cancel any ongoing streams
  for (const result of state.results.values()) {
    result.controller?.abort();
  }

  state.comparing = true;
  state.results.clear();
  state.maxLatencyMs = 1;
  el.runBtn.disabled = true;
  showGlobalError(null);

  // Pre-create result entries so cards appear immediately
  for (const pid of providers) {
    state.results.set(pid, { text: "", ok: null, working: true, startTime: Date.now() });
  }
  renderResultCards();
  setStatus(`Streaming da ${providers.join(", ")}…`, "busy");

  // Launch N concurrent SSE streams
  await Promise.allSettled(providers.map((pid) => streamProvider(pid, prompt)));

  state.comparing = false;
  el.runBtn.disabled = false;

  const done = [...state.results.values()].filter((r) => r.ok === true).length;
  const total = providers.length;
  setStatus(`Completato: ${done}/${total} provider.`, "done");

  // Refresh sidebar state
  await loadOverview();
}

async function streamProvider(providerId, prompt) {
  const controller = new AbortController();
  const entry = state.results.get(providerId);
  entry.controller = controller;
  const startTime = entry.startTime;

  try {
    const res = await fetch(`/providers/${providerId}/stream`, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ prompt }),
      signal:  controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE: events separated by double newline
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const dataLine = block.split("\n").find((l) => l.startsWith("data: "));
        if (!dataLine) continue;

        let event;
        try { event = JSON.parse(dataLine.slice(6)); } catch { continue; }

        if (event.type === "token") {
          entry.text += event.delta;
          updateResultCard(providerId);
        } else if (event.type === "done") {
          const latencyMs = Date.now() - startTime;
          entry.text      = event.text ?? entry.text;
          entry.ok        = true;
          entry.working   = false;
          entry.latencyMs = latencyMs;
          if (latencyMs > state.maxLatencyMs) state.maxLatencyMs = latencyMs;
          updateResultCard(providerId);
          setStatus(`${providerId} completato in ${latencyMs}ms`, "busy");
        } else if (event.type === "quota_rotating") {
          // Clear quota text already streamed; a fresh response from the new account follows.
          entry.text = "";
          entry.quotaRotating = true;
          entry.rotatingFrom  = event.fromEmail;
          entry.rotatingTo    = event.toEmail;
          updateResultCard(providerId);
          toast(`${providerId}: quota esaurita su ${event.fromEmail} → rotazione a ${event.toEmail}`, "warn", 5000);
        } else if (event.type === "error") {
          entry.ok      = false;
          entry.working = false;
          entry.error   = event.detail ?? event.error ?? "Errore sconosciuto";
          entry.code    = event.code;
          entry.hint    = event.hint;
          entry.latencyMs = Date.now() - startTime;
          updateResultCard(providerId);
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    entry.ok      = false;
    entry.working = false;
    entry.error   = err.message;
    entry.latencyMs = Date.now() - startTime;
    updateResultCard(providerId);
  }
}

// ── Render all result cards from scratch ──────────────────
function renderResultCards() {
  el.resultsGrid.innerHTML = "";
  if (state.results.size === 0) {
    el.resultsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-glyph">◈</div>
        <p>Nessun confronto. Completa il login dei provider, inserisci un prompt e premi CONFRONTA.</p>
      </div>`;
    return;
  }

  for (const [pid] of state.results) {
    const card = buildCardElement(pid);
    el.resultsGrid.appendChild(card);
  }
}

// Build DOM for a single result card
function buildCardElement(pid) {
  const entry = state.results.get(pid);
  const provider = state.providers.find((p) => p.id === pid);
  const label = provider?.label ?? pid;

  const stClass = entry.working ? "is-working"
    : entry.ok === true  ? "is-ok"
    : entry.ok === false ? "is-error"
    : "is-working";

  const badgeClass = entry.working ? "working"
    : entry.ok === true  ? "ok"
    : "error";

  const badgeText = entry.working
    ? "STREAMING…"
    : entry.ok === true
    ? (entry.latencyMs ? `${entry.latencyMs}ms` : "DONE")
    : "ERROR";

  const card = document.createElement("article");
  card.className = `result-card ${stClass}`;
  card.dataset.provider = pid;

  const rotatingBanner = entry.quotaRotating
    ? `<div class="result-quota-banner">⟳ QUOTA: ${escHtml(entry.rotatingFrom ?? "")} → ${escHtml(entry.rotatingTo ?? "")}</div>`
    : "";

  card.innerHTML = `
    <div class="result-card-head">
      <span class="result-card-name">${escHtml(label)}</span>
      <span class="result-badge ${badgeClass}">${badgeText}</span>
    </div>
    <div class="result-progress">
      <div class="result-progress-fill"></div>
    </div>
    ${rotatingBanner}
    ${entry.ok === false ? `
    <div class="result-error">
      <div>${escHtml(entry.error ?? "Errore sconosciuto")}</div>
      ${entry.code ? `<div class="result-error-code">${escHtml(entry.code)}</div>` : ""}
      ${entry.hint ? `<div class="result-error-hint">${escHtml(entry.hint)}</div>` : ""}
    </div>` : `
    <div class="result-text" data-provider="${pid}"></div>`}
  `;

  // Set text content without XSS risk
  if (entry.ok !== false) {
    const textEl = card.querySelector(".result-text");
    textEl.textContent = entry.text;
    if (entry.working) {
      const cursor = document.createElement("span");
      cursor.className = "stream-cursor";
      textEl.appendChild(cursor);
    }
  }

  return card;
}

// Update a single card in place (efficient streaming updates)
function updateResultCard(pid) {
  const existing = el.resultsGrid.querySelector(`[data-provider="${pid}"].result-card`);
  const entry = state.results.get(pid);

  if (!existing) {
    el.resultsGrid.appendChild(buildCardElement(pid));
    return;
  }

  // Update state class
  const newClass = entry.working ? "is-working"
    : entry.ok === true  ? "is-ok"
    : entry.ok === false ? "is-error"
    : "is-working";

  existing.className = `result-card ${newClass}`;

  // Update badge
  const badge = existing.querySelector(".result-badge");
  if (badge) {
    badge.className = `result-badge ${entry.working ? "working" : entry.ok ? "ok" : "error"}`;
    badge.textContent = entry.working
      ? "STREAMING…"
      : entry.ok === true
      ? (entry.latencyMs ? `${entry.latencyMs}ms` : "DONE")
      : "ERROR";
  }

  // Update text (streaming)
  const textEl = existing.querySelector(".result-text");
  if (textEl) {
    // Preserve scroll position
    const atBottom = textEl.scrollHeight - textEl.scrollTop <= textEl.clientHeight + 20;
    textEl.textContent = entry.text;
    if (entry.working) {
      const cursor = document.createElement("span");
      cursor.className = "stream-cursor";
      textEl.appendChild(cursor);
    }
    if (atBottom) textEl.scrollTop = textEl.scrollHeight;
  }

  // When done, rebuild the full card
  if (!entry.working && entry.ok !== null) {
    const fresh = buildCardElement(pid);
    existing.replaceWith(fresh);
  }
}

// ── Utilities ──────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(text, mode = "") {
  el.compareStatus.textContent = text;
  el.compareStatus.className = `compare-status ${mode}`;
}

function showGlobalError(payload) {
  if (!payload) {
    el.globalError.classList.add("hidden");
    el.globalError.innerHTML = "";
    return;
  }
  el.globalError.classList.remove("hidden");
  el.globalError.innerHTML = `
    <div class="global-error-title">${escHtml(payload.title ?? "Errore")}</div>
    <div class="global-error-detail">${escHtml(payload.detail ?? "")}</div>
  `;
}

// ── Topbar clock ──────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  el.statTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Keyboard shortcuts ────────────────────────────────────
document.addEventListener("keydown", (e) => {
  // Don't trigger shortcuts when typing in textarea
  if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (!state.comparing) runCompare();
    }
    return;
  }

  switch (e.key) {
    case "?":
      el.helpOverlay.classList.remove("hidden");
      break;
    case "Escape":
      el.helpOverlay.classList.add("hidden");
      break;
    case "r":
    case "R":
      if (!el.refreshBtn.disabled) loadOverview();
      break;
    case "1": case "2": case "3": case "4": {
      const idx = parseInt(e.key, 10) - 1;
      if (idx < state.providers.length) {
        const pid = state.providers[idx].id;
        if (state.selectedProviders.has(pid)) state.selectedProviders.delete(pid);
        else state.selectedProviders.add(pid);
        saveSelectedProviders();
        renderSidebar();
      }
      break;
    }
  }
});

// ── Event listeners ───────────────────────────────────────
el.refreshBtn.addEventListener("click", loadOverview);
el.runBtn.addEventListener("click", runCompare);
el.promptInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    if (!state.comparing) runCompare();
  }
});

el.helpBtn.addEventListener("click", () => el.helpOverlay.classList.remove("hidden"));
el.helpClose.addEventListener("click", () => el.helpOverlay.classList.add("hidden"));
el.helpOverlay.addEventListener("click", (e) => {
  if (e.target === el.helpOverlay) el.helpOverlay.classList.add("hidden");
});

// ── Boot ──────────────────────────────────────────────────
setStatus("Inizializzazione…");
loadOverview().then(() => {
  setStatus("Sistema pronto. Seleziona provider e invia un prompt.");
  toast("NEXUS CONTROL avviato", "ok", 2500);

  // Auto-refresh during boot to pick up server-side auto-login.
  // The server fires login() for all persisted providers at startup;
  // we poll for up to ~20s so the sidebar reflects READY without user action.
  let bootPolls = 0;
  const bootInterval = setInterval(async () => {
    bootPolls++;
    if (bootPolls >= 6) { clearInterval(bootInterval); return; }
    await loadOverview();
    const allSettled = state.providers.every(
      (p) => p.status?.ready || (p.status?.error && p.status.launched !== undefined),
    );
    if (allSettled) clearInterval(bootInterval);
  }, 3500);
});
