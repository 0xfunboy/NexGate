/* NEXUS CONTROL — multilingual frontend with per-provider SSE streaming */

const TRANSLATIONS = {
  en: {
    document_title: "NEXUS CONTROL — LLM Gateway",
    lang_switch_aria: "Language switcher",
    refresh_title: "Refresh status",
    help_title_button: "Shortcuts",
    sidebar_header: "PROVIDER SESSIONS",
    prompt_section: "PROMPT LAB",
    prompt_hint: "Select providers · Ctrl+Enter to run",
    prompt_placeholder: "Write the prompt to send to the selected providers…",
    compare_button: "COMPARE",
    compare_section: "COMPARE VIEW",
    empty_compare: "No comparison yet. Complete provider login, enter a prompt, and press COMPARE.",
    help_title: "KEYBOARD SHORTCUTS",
    help_run: "Run compare",
    help_refresh: "Refresh provider status",
    help_toggle: "Toggle providers 1–4",
    help_close: "Close overlay",
    help_show: "Show this guide",
    help_close_button: "CLOSE",
    stat_ready_suffix: "READY",
    stat_open_suffix: "OPEN",
    provider_status_none: "NOT INIT",
    provider_status_quota: "QUOTA",
    provider_status_ready: "READY",
    provider_status_error: "ERROR",
    provider_status_open: "OPEN",
    provider_status_saved: "SAVED",
    provider_status_idle: "IDLE",
    button_login: "LOGIN",
    button_check: "CHECK",
    button_reset: "RESET",
    button_rotate: "ROTATE",
    button_unlock: "UNLOCK",
    status_opening_login: "Opening {provider} in Playwright. Complete the login, then click CHECK.",
    toast_browser_opened: "{provider}: browser opened",
    status_provider_ready: "{provider} is ready.",
    status_provider_not_ready: "{provider} is not ready. {hint}",
    toast_provider_ready: "{provider}: ready",
    toast_provider_not_ready: "{provider}: {code}",
    status_provider_reset: "{provider} reset.",
    toast_provider_reset: "{provider}: reset",
    toast_rotate_success: "{provider}: rotated to {email}",
    toast_rotate_fail: "{provider}: all accounts are quota exhausted",
    toast_quota_reset: "{provider}: quota flags reset",
    error_loading_title: "Load error",
    toast_loading_error: "Failed to load providers",
    compare_missing_prompt: "Enter a prompt before running compare.",
    compare_missing_providers: "Select at least one provider.",
    compare_streaming: "Streaming from {providers}…",
    compare_complete: "Completed: {done}/{total} providers.",
    provider_completed: "{provider} completed in {latency}ms",
    quota_rotating_toast: "{provider}: quota exhausted on {fromEmail} → rotating to {toEmail}",
    empty_glyph_text: "No comparison yet. Complete provider login, enter a prompt, and press COMPARE.",
    badge_streaming: "STREAMING…",
    badge_done: "DONE",
    badge_error: "ERROR",
    unknown_error: "Unknown error",
    system_initializing: "Initializing…",
    system_ready: "System ready. Select providers and send a prompt.",
    boot_toast: "NEXUS CONTROL started",
    global_error_title: "Error",
    quota_banner: "⟳ QUOTA: {from} → {to}",
    compare_meta_idle: "Parallel per-provider SSE stream",
    compare_meta_active: "{count}/{total} active",
    runtime_saved_profile_error: "Saved browser profile, but the session is not open.",
    runtime_saved_profile_hint: "Press Login to reopen the browser on the saved profile.",
    runtime_manual_challenge_error: "Manual challenge required by the provider.",
    runtime_manual_challenge_hint: "Complete the captcha or human verification in the Playwright window, then click Check.",
    runtime_temp_provider_error: "The provider is showing a temporary error page.",
    runtime_temp_provider_hint: "Reload from the Playwright window or use Reset and Login again after a few seconds.",
    runtime_login_required: "Login not completed yet.",
    runtime_login_hint: "Complete login in the Playwright window. If the Google account picker appears, choose the same account used before.",
    runtime_quota_title: "Quota exhausted",
    runtime_quota_detail: "Account {account} hit the usage limit on {provider}.",
    runtime_quota_hint: "The system will attempt automatic rotation to a backup account if one is available.",
    runtime_session_closed_title: "Browser session closed",
    runtime_session_closed_detail: "The Playwright window or provider tab is no longer active.",
    runtime_session_closed_hint: "Press Reset and then Login to create a clean session.",
    runtime_provider_not_ready_title: "Provider not ready",
    runtime_provider_not_ready_detail: "The provider is open but the chat input was not recognized.",
    runtime_provider_not_ready_hint: "Complete login or manual challenges, then click Check. If the site changed, update the provider selectors.",
    runtime_html_instead_title: "Unexpected site response",
    runtime_html_instead_detail: "The frontend returned HTML instead of the expected flow. This usually means a challenge, redirect, or error page.",
    runtime_html_instead_hint: "Check the Playwright window: login might be incomplete, a captcha may be shown, or an intermediate page may be open.",
    runtime_provider_temp_title: "Temporary provider error",
    runtime_provider_temp_detail: "The provider website returned a temporary error.",
    runtime_provider_temp_hint: "Wait a few seconds and try again. If it persists, use Reset and reopen the session.",
    runtime_network_title: "Browser network error",
    runtime_network_detail: "The Playwright browser did not complete navigation successfully.",
    runtime_network_hint: "Check connectivity, challenges, and provider redirects, then retry.",
    runtime_unexpected_title: "Unexpected error",
    runtime_unexpected_hint: "Use Reset to recreate the session if the problem persists.",
    runtime_audio_not_found: "Audio not found",
    runtime_audio_not_found_detail: "No audio is available for {provider}. Generate read aloud first.",
    runtime_all_accounts_exhausted: "All accounts for {provider} have exhausted their quota.",
    runtime_provider_not_ready_generic: "Provider {provider} is not ready. Update providers.config.json with the correct selectors after login.",
    runtime_input_not_found: "Input not found for {provider}.",
    runtime_timeout_max: "Provider {provider} exceeded the maximum response timeout.",
    runtime_timeout_first_chunk: "Provider {provider} did not start responding before the initial timeout.",
    runtime_no_useful_text: "Provider {provider} did not produce useful response text.",
    runtime_provider_busy: "Provider {provider} stayed busy too long; unable to send a new prompt.",
    runtime_grok_audio_missing: "Grok did not expose readable audio after clicking read aloud.",
    runtime_grok_audio_button_missing: "Grok read-aloud button not found.",
  },
  it: {
    document_title: "NEXUS CONTROL — LLM Gateway",
    lang_switch_aria: "Selettore lingua",
    refresh_title: "Aggiorna stato",
    help_title_button: "Scorciatoie",
    sidebar_header: "SESSIONI PROVIDER",
    prompt_section: "PROMPT LAB",
    prompt_hint: "Seleziona provider · Ctrl+Enter per avviare",
    prompt_placeholder: "Scrivi il prompt da inviare ai provider selezionati…",
    compare_button: "CONFRONTA",
    compare_section: "COMPARE VIEW",
    empty_compare: "Nessun confronto. Completa il login dei provider, inserisci un prompt e premi CONFRONTA.",
    help_title: "SCORCIATOIE DA TASTIERA",
    help_run: "Avvia confronto",
    help_refresh: "Aggiorna stato provider",
    help_toggle: "Attiva/disattiva provider 1–4",
    help_close: "Chiudi overlay",
    help_show: "Mostra questa guida",
    help_close_button: "CHIUDI",
    stat_ready_suffix: "PRONTO",
    stat_open_suffix: "APERTO",
    provider_status_none: "NON INIT",
    provider_status_quota: "QUOTA",
    provider_status_ready: "PRONTO",
    provider_status_error: "ERRORE",
    provider_status_open: "APERTO",
    provider_status_saved: "SALVATO",
    provider_status_idle: "IDLE",
    button_login: "LOGIN",
    button_check: "VERIFICA",
    button_reset: "RESET",
    button_rotate: "RUOTA",
    button_unlock: "SBLOCCA",
    status_opening_login: "Apro {provider} in Playwright. Completa il login, poi clicca VERIFICA.",
    toast_browser_opened: "{provider}: browser aperto",
    status_provider_ready: "{provider} pronto.",
    status_provider_not_ready: "{provider} non pronto. {hint}",
    toast_provider_ready: "{provider}: pronto",
    toast_provider_not_ready: "{provider}: {code}",
    status_provider_reset: "{provider} resettato.",
    toast_provider_reset: "{provider}: resettato",
    toast_rotate_success: "{provider}: rotazione a {email}",
    toast_rotate_fail: "{provider}: tutti gli account hanno quota esaurita",
    toast_quota_reset: "{provider}: quota resettata",
    error_loading_title: "Errore caricamento",
    toast_loading_error: "Errore caricamento provider",
    compare_missing_prompt: "Inserisci un prompt prima di avviare.",
    compare_missing_providers: "Seleziona almeno un provider.",
    compare_streaming: "Streaming da {providers}…",
    compare_complete: "Completato: {done}/{total} provider.",
    provider_completed: "{provider} completato in {latency}ms",
    quota_rotating_toast: "{provider}: quota esaurita su {fromEmail} → rotazione a {toEmail}",
    empty_glyph_text: "Nessun confronto. Completa il login dei provider, inserisci un prompt e premi CONFRONTA.",
    badge_streaming: "STREAMING…",
    badge_done: "FATTO",
    badge_error: "ERRORE",
    unknown_error: "Errore sconosciuto",
    system_initializing: "Inizializzazione…",
    system_ready: "Sistema pronto. Seleziona i provider e invia un prompt.",
    boot_toast: "NEXUS CONTROL avviato",
    global_error_title: "Errore",
    quota_banner: "⟳ QUOTA: {from} → {to}",
    compare_meta_idle: "SSE parallelo per provider",
    compare_meta_active: "{count}/{total} attivi",
    runtime_saved_profile_error: "Profilo browser salvato ma sessione non aperta.",
    runtime_saved_profile_hint: "Premi Login per riaprire il browser sul profilo salvato.",
    runtime_manual_challenge_error: "Challenge manuale richiesta dal provider.",
    runtime_manual_challenge_hint: "Completa captcha o verifica umana nella finestra Playwright, poi clicca Verifica.",
    runtime_temp_provider_error: "Il provider sta mostrando una pagina errore temporanea.",
    runtime_temp_provider_hint: "Ricarica dalla finestra Playwright o usa Reset e Login di nuovo dopo qualche secondo.",
    runtime_login_required: "Login non ancora completato.",
    runtime_login_hint: "Completa il login nella finestra Playwright. Se compare l'account picker Google, scegli lo stesso account usato prima.",
    runtime_quota_title: "Quota esaurita",
    runtime_quota_detail: "L'account {account} ha raggiunto il limite di utilizzo su {provider}.",
    runtime_quota_hint: "Il sistema tenterà la rotazione automatica verso un account di backup, se disponibile.",
    runtime_session_closed_title: "Sessione browser chiusa",
    runtime_session_closed_detail: "La finestra Playwright o il tab del provider non sono più attivi.",
    runtime_session_closed_hint: "Premi Reset e poi Login per creare una sessione pulita.",
    runtime_provider_not_ready_title: "Provider non pronto",
    runtime_provider_not_ready_detail: "Il provider è aperto ma l'input chat non è stato riconosciuto.",
    runtime_provider_not_ready_hint: "Completa login o challenge manuali, poi clicca Verifica. Se il sito è cambiato, aggiorna i selettori del provider.",
    runtime_html_instead_title: "Risposta inattesa del sito",
    runtime_html_instead_detail: "Il frontend ha restituito HTML invece del flusso atteso. Di solito significa challenge, redirect o pagina errore.",
    runtime_html_instead_hint: "Controlla la finestra Playwright: login incompleto, captcha o pagina intermedia.",
    runtime_provider_temp_title: "Errore temporaneo del provider",
    runtime_provider_temp_detail: "Il sito del provider ha risposto con un errore temporaneo.",
    runtime_provider_temp_hint: "Aspetta qualche secondo e riprova. Se persiste, usa Reset e riapri la sessione.",
    runtime_network_title: "Errore di rete del browser",
    runtime_network_detail: "Il browser Playwright non ha completato correttamente la navigazione.",
    runtime_network_hint: "Verifica connettività, challenge e redirect del provider, poi riprova.",
    runtime_unexpected_title: "Errore inatteso",
    runtime_unexpected_hint: "Usa Reset per ricreare la sessione se il problema persiste.",
    runtime_audio_not_found: "Audio non trovato",
    runtime_audio_not_found_detail: "Nessun audio disponibile per {provider}. Genera prima il read aloud.",
    runtime_all_accounts_exhausted: "Tutti gli account per {provider} hanno la quota esaurita.",
    runtime_provider_not_ready_generic: "Provider {provider} non pronto. Aggiorna providers.config.json con i selettori corretti dopo il login.",
    runtime_input_not_found: "Input non trovato per {provider}.",
    runtime_timeout_max: "Provider {provider} ha superato il timeout massimo di risposta.",
    runtime_timeout_first_chunk: "Provider {provider} non ha iniziato a rispondere entro il timeout iniziale.",
    runtime_no_useful_text: "Provider {provider} non ha prodotto testo utile in risposta.",
    runtime_provider_busy: "Provider {provider} è rimasto occupato troppo a lungo; impossibile inviare un nuovo prompt.",
    runtime_grok_audio_missing: "Grok non ha esposto un audio leggibile dopo il click su read aloud.",
    runtime_grok_audio_button_missing: "Pulsante read aloud di Grok non trovato.",
  },
};

const state = {
  providers: [],
  selectedProviders: new Set(loadSelectedProviders()),
  results: new Map(),
  comparing: false,
  maxLatencyMs: 1,
  lang: loadLanguage(),
  statusState: { type: "key", key: "system_initializing", vars: {}, mode: "" },
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

function loadLanguage() {
  const raw = localStorage.getItem("nexus_lang");
  return raw === "it" || raw === "en" ? raw : "en";
}

function saveLanguage() {
  localStorage.setItem("nexus_lang", state.lang);
}

const $ = (id) => document.getElementById(id);

const el = {
  providersList: $("providers-list"),
  providerPicker: $("provider-picker"),
  promptInput: $("prompt-input"),
  runBtn: $("run-compare"),
  runLabel: $("run-label"),
  compareStatus: $("compare-status"),
  compareMeta: $("compare-meta"),
  resultsGrid: $("results-grid"),
  globalError: $("global-error"),
  refreshBtn: $("refresh-status"),
  helpBtn: $("help-btn"),
  helpOverlay: $("help-overlay"),
  helpClose: $("help-close"),
  helpTitle: $("help-title"),
  helpRowRun: $("help-row-run"),
  helpRowRefresh: $("help-row-refresh"),
  helpRowToggle: $("help-row-toggle"),
  helpRowClose: $("help-row-close"),
  helpRowShow: $("help-row-show"),
  promptSectionLabel: $("prompt-section-label"),
  compareSectionLabel: $("compare-section-label"),
  promptHint: $("prompt-hint"),
  emptyStateText: $("empty-state-text"),
  sidebarHeaderText: $("sidebar-header-text"),
  statReady: $("stat-ready"),
  statLaunched: $("stat-launched"),
  statTime: $("stat-time"),
  toasts: $("toasts"),
  langSwitch: $("lang-switch"),
  langIt: $("lang-it"),
  langEn: $("lang-en"),
};

function t(key, vars = {}) {
  const template = TRANSLATIONS[state.lang]?.[key] ?? TRANSLATIONS.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? ""));
}

function setLanguage(lang) {
  if (lang !== "it" && lang !== "en") return;
  state.lang = lang;
  saveLanguage();
  document.documentElement.lang = lang;
  applyTranslations();
  renderSidebar();
  renderResultCards();
  renderStatus();
}

function applyTranslations() {
  document.title = t("document_title");
  el.refreshBtn.title = `${t("refresh_title")} (R)`;
  el.helpBtn.title = `${t("help_title_button")} (?)`;
  el.sidebarHeaderText.textContent = t("sidebar_header");
  el.promptSectionLabel.textContent = t("prompt_section");
  el.promptHint.textContent = t("prompt_hint");
  el.promptInput.placeholder = t("prompt_placeholder");
  el.runLabel.textContent = t("compare_button");
  el.compareSectionLabel.textContent = t("compare_section");
  if (el.emptyStateText) {
    el.emptyStateText.textContent = t("empty_compare");
  }
  el.helpOverlay.setAttribute("aria-label", t("help_title"));
  el.helpTitle.textContent = t("help_title");
  el.helpRowRun.textContent = t("help_run");
  el.helpRowRefresh.textContent = t("help_refresh");
  el.helpRowToggle.textContent = t("help_toggle");
  el.helpRowClose.textContent = t("help_close");
  el.helpRowShow.textContent = t("help_show");
  el.helpClose.textContent = t("help_close_button");
  el.langSwitch.setAttribute("aria-label", t("lang_switch_aria"));
  el.langIt.title = state.lang === "it" ? "Italiano" : "Italian";
  el.langEn.title = state.lang === "it" ? "Inglese" : "English";
  el.langIt.setAttribute("aria-label", el.langIt.title);
  el.langEn.setAttribute("aria-label", el.langEn.title);
  el.langIt.classList.toggle("active", state.lang === "it");
  el.langEn.classList.toggle("active", state.lang === "en");
  renderTopStats();
  updateCompareMeta();
}

function renderTopStats() {
  const readyCount = state.providers.filter((p) => p.status?.ready).length;
  const launchedCount = state.providers.filter((p) => p.status?.launched).length;
  el.statReady.textContent = `${readyCount} ${t("stat_ready_suffix")}`;
  el.statLaunched.textContent = `${launchedCount} ${t("stat_open_suffix")}`;
  el.statReady.classList.toggle("alive", readyCount > 0);
  el.statLaunched.classList.toggle("alive", launchedCount > 0);
}

function updateCompareMeta() {
  if (state.comparing) {
    const active = [...state.results.values()].filter((entry) => entry.working).length;
    el.compareMeta.textContent = t("compare_meta_active", { count: active, total: state.results.size });
    return;
  }

  el.compareMeta.textContent = t("compare_meta_idle");
}

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
    const err = new Error((payload && typeof payload === "object" ? payload.detail ?? payload.message : payload) || `HTTP ${res.status}`);
    err.ui = payload;
    throw err;
  }

  return payload;
}

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
  node.addEventListener("click", () => {
    clearTimeout(timer);
    remove();
  });
}

function providerStateClass(status) {
  if (!status) return "is-waiting";
  if (status.quotaState === "exhausted") return "is-quota";
  if (status.ready) return "is-ready";
  if (status.error) return "is-error";
  if (status.launched) return "is-working";
  return "is-waiting";
}

function providerStatusLabel(status) {
  if (!status) return t("provider_status_none");
  if (status.quotaState === "exhausted") return t("provider_status_quota");
  if (status.ready) return t("provider_status_ready");
  if (status.error) return status.code ?? t("provider_status_error");
  if (status.launched) return t("provider_status_open");
  return status.persisted ? t("provider_status_saved") : t("provider_status_idle");
}

function makeRingInitials(id) {
  const map = { chatgpt: "CG", claude: "CL", gemini: "GM", grok: "GK" };
  return map[id] ?? id.slice(0, 2).toUpperCase();
}

function renderSidebar() {
  el.providersList.innerHTML = "";
  el.providerPicker.innerHTML = "";

  for (const p of state.providers) {
    const stClass = providerStateClass(p.status);
    const label = providerStatusLabel(p.status);
    const url = p.status?.url ?? p.baseUrl;
    const shortUrl = url.replace(/^https?:\/\//, "").replace(/\/.*/, "");
    const activeAccount = (p.accounts ?? []).find((a) => a.active);
    const email = activeAccount?.email ?? p.status?.account ?? "";
    const showEmail = email && email !== "unknown";
    const hasBackup = (p.accounts ?? []).some((a) => !a.active && a.quotaState !== "exhausted");
    const isQuota = stClass === "is-quota";

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
          <div class="provider-item-status ${stClass}">${escHtml(label)}</div>
          ${showEmail ? `<div class="provider-item-account">${escHtml(email)}</div>` : ""}
        </div>
      </div>
      <div class="provider-item-url">${escHtml(shortUrl)}</div>
      <div class="provider-item-actions">
        <button class="item-btn btn-login" data-action="login" data-provider="${p.id}">${t("button_login")}</button>
        <button class="item-btn btn-verify" data-action="verify" data-provider="${p.id}">${t("button_check")}</button>
        <button class="item-btn btn-reset" data-action="reset" data-provider="${p.id}">${t("button_reset")}</button>
        ${isQuota && hasBackup ? `<button class="item-btn btn-rotate" data-action="rotate" data-provider="${p.id}">${t("button_rotate")}</button>` : ""}
        ${isQuota && !hasBackup ? `<button class="item-btn btn-reset-quota" data-action="reset-quota" data-provider="${p.id}">${t("button_unlock")}</button>` : ""}
      </div>
    `;
    el.providersList.appendChild(item);

    const chip = document.createElement("label");
    chip.className = "picker-chip";
    chip.innerHTML = `
      <input type="checkbox" value="${p.id}" ${state.selectedProviders.has(p.id) ? "checked" : ""}/>
      <span class="chip-dot"></span>
      <span>${escHtml(p.label)}</span>
    `;
    chip.querySelector("input").addEventListener("change", (event) => {
      if (event.target.checked) state.selectedProviders.add(p.id);
      else state.selectedProviders.delete(p.id);
      saveSelectedProviders();
    });
    el.providerPicker.appendChild(chip);
  }

  renderTopStats();
  el.providersList.querySelectorAll(".item-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleProviderAction(btn));
  });
}

async function handleProviderAction(btn) {
  const action = btn.dataset.action;
  const provider = btn.dataset.provider;
  const card = btn.closest(".provider-item");
  card.querySelectorAll(".item-btn").forEach((button) => {
    button.disabled = true;
  });
  showGlobalError(null);

  try {
    if (action === "login") {
      setStatusKey("status_opening_login", { provider }, "busy");
      await api(`/providers/${provider}/login`, { method: "POST", body: "{}" });
      toast(t("toast_browser_opened", { provider }), "ok");
    } else if (action === "verify") {
      const status = await api(`/providers/${provider}/status`);
      const target = state.providers.find((entry) => entry.id === provider);
      if (target) {
        target.status = status;
        renderSidebar();
      }
      if (status.ready) {
        setStatusKey("status_provider_ready", { provider }, "done");
        toast(t("toast_provider_ready", { provider }), "ok");
      } else {
        setStatusKey("status_provider_not_ready", { provider, hint: localizeRuntimeText(status.hint ?? "") }, "busy");
        toast(t("toast_provider_not_ready", { provider, code: status.code ?? t("provider_status_none") }), "warn");
      }
    } else if (action === "reset") {
      await api(`/providers/${provider}/reset`, { method: "POST", body: "{}" });
      const target = state.providers.find((entry) => entry.id === provider);
      if (target) {
        target.status = { provider, ready: false, launched: false };
        renderSidebar();
      }
      setStatusKey("status_provider_reset", { provider });
      toast(t("toast_provider_reset", { provider }), "warn");
    } else if (action === "rotate") {
      const result = await api(`/providers/${provider}/accounts/rotate`, { method: "POST", body: "{}" });
      if (result.rotated) {
        toast(t("toast_rotate_success", { provider, email: result.active.email }), "ok");
      } else {
        toast(t("toast_rotate_fail", { provider }), "err");
      }
      await loadOverview();
    } else if (action === "reset-quota") {
      await api(`/providers/${provider}/accounts/reset-quota`, { method: "POST", body: "{}" });
      toast(t("toast_quota_reset", { provider }), "ok");
      await loadOverview();
    }
  } catch (err) {
    const payload = localizePayload(err.ui ?? { title: t("global_error_title"), detail: err.message });
    showGlobalError(payload);
    toast(`${provider}: ${payload.detail ?? payload.title}`, "err");
  } finally {
    card.querySelectorAll(".item-btn").forEach((button) => {
      button.disabled = false;
    });
  }
}

async function loadOverview() {
  el.refreshBtn.classList.add("spinning");
  try {
    state.providers = await api("/providers/overview");
    renderSidebar();
    showGlobalError(null);
  } catch (err) {
    showGlobalError(localizePayload(err.ui ?? { title: t("error_loading_title"), detail: err.message }));
    toast(t("toast_loading_error"), "err");
  } finally {
    el.refreshBtn.classList.remove("spinning");
  }
}

async function runCompare() {
  const prompt = el.promptInput.value.trim();
  const providers = [...state.selectedProviders];

  if (!prompt) {
    setStatusKey("compare_missing_prompt");
    return;
  }
  if (!providers.length) {
    setStatusKey("compare_missing_providers");
    return;
  }

  for (const result of state.results.values()) {
    result.controller?.abort();
  }

  state.comparing = true;
  state.results.clear();
  state.maxLatencyMs = 1;
  el.runBtn.disabled = true;
  showGlobalError(null);

  for (const pid of providers) {
    state.results.set(pid, { text: "", images: [], ok: null, working: true, startTime: Date.now() });
  }

  renderResultCards();
  updateCompareMeta();
  setStatusKey("compare_streaming", { providers: providers.join(", ") }, "busy");

  await Promise.allSettled(providers.map((pid) => streamProvider(pid, prompt)));

  state.comparing = false;
  el.runBtn.disabled = false;
  updateCompareMeta();

  const done = [...state.results.values()].filter((entry) => entry.ok === true).length;
  setStatusKey("compare_complete", { done, total: providers.length }, "done");
  await loadOverview();
}

async function streamProvider(providerId, prompt) {
  const controller = new AbortController();
  const entry = state.results.get(providerId);
  entry.controller = controller;
  const startTime = entry.startTime;

  try {
    const res = await fetch(`/providers/${providerId}/stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        let event;
        try {
          event = JSON.parse(dataLine.slice(6));
        } catch {
          continue;
        }

        if (event.type === "token") {
          entry.text += event.delta;
          updateResultCard(providerId);
        } else if (event.type === "done") {
          const latencyMs = Date.now() - startTime;
          entry.text = event.text ?? entry.text;
          entry.images = Array.isArray(event.images) ? event.images : [];
          entry.ok = true;
          entry.working = false;
          entry.latencyMs = latencyMs;
          if (latencyMs > state.maxLatencyMs) state.maxLatencyMs = latencyMs;
          updateResultCard(providerId);
          setStatusKey("provider_completed", { provider: providerId, latency: latencyMs }, "busy");
          updateCompareMeta();
        } else if (event.type === "quota_rotating") {
          entry.text = "";
          entry.images = [];
          entry.quotaRotating = true;
          entry.rotatingFrom = event.fromEmail;
          entry.rotatingTo = event.toEmail;
          updateResultCard(providerId);
          toast(t("quota_rotating_toast", { provider: providerId, fromEmail: event.fromEmail, toEmail: event.toEmail }), "warn", 5000);
        } else if (event.type === "error") {
          const localized = localizePayload(event);
          entry.ok = false;
          entry.working = false;
          entry.error = localized.detail ?? localized.error ?? t("unknown_error");
          entry.code = localized.code;
          entry.hint = localized.hint;
          entry.latencyMs = Date.now() - startTime;
          updateResultCard(providerId);
          updateCompareMeta();
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    entry.ok = false;
    entry.working = false;
    entry.error = localizeRuntimeText(err.message) || t("unknown_error");
    entry.latencyMs = Date.now() - startTime;
    updateResultCard(providerId);
    updateCompareMeta();
  }
}

function renderResultCards() {
  el.resultsGrid.innerHTML = "";

  if (state.results.size === 0) {
    el.resultsGrid.innerHTML = `
      <div class="empty-state">
        <div class="empty-glyph">◈</div>
        <p>${escHtml(t("empty_compare"))}</p>
      </div>`;
    return;
  }

  for (const [pid] of state.results) {
    el.resultsGrid.appendChild(buildCardElement(pid));
  }
}

function buildCardElement(pid) {
  const entry = state.results.get(pid);
  const provider = state.providers.find((p) => p.id === pid);
  const label = provider?.label ?? pid;

  const stClass = entry.working ? "is-working"
    : entry.ok === true ? "is-ok"
    : entry.ok === false ? "is-error"
    : "is-working";

  const badgeClass = entry.working ? "working" : entry.ok === true ? "ok" : "error";
  const badgeText = entry.working
    ? t("badge_streaming")
    : entry.ok === true
      ? (entry.latencyMs ? `${entry.latencyMs}ms` : t("badge_done"))
      : t("badge_error");

  const card = document.createElement("article");
  card.className = `result-card ${stClass}`;
  card.dataset.provider = pid;

  const rotatingBanner = entry.quotaRotating
    ? `<div class="result-quota-banner">${escHtml(t("quota_banner", { from: entry.rotatingFrom ?? "", to: entry.rotatingTo ?? "" }))}</div>`
    : "";

  card.innerHTML = `
    <div class="result-card-head">
      <span class="result-card-name">${escHtml(label)}</span>
      <span class="result-badge ${badgeClass}">${escHtml(badgeText)}</span>
    </div>
    <div class="result-progress">
      <div class="result-progress-fill"></div>
    </div>
    ${rotatingBanner}
    ${entry.ok === false ? `
      <div class="result-error">
        <div>${escHtml(entry.error ?? t("unknown_error"))}</div>
        ${entry.code ? `<div class="result-error-code">${escHtml(entry.code)}</div>` : ""}
        ${entry.hint ? `<div class="result-error-hint">${escHtml(entry.hint)}</div>` : ""}
      </div>` : `
      <div class="result-body" data-provider="${pid}"></div>`}
  `;

  if (entry.ok !== false) {
    renderResultBody(card.querySelector(".result-body"), entry);
  }

  return card;
}

function updateResultCard(pid) {
  const existing = el.resultsGrid.querySelector(`[data-provider="${pid}"].result-card`);
  const entry = state.results.get(pid);

  if (!existing) {
    el.resultsGrid.appendChild(buildCardElement(pid));
    return;
  }

  const newClass = entry.working ? "is-working"
    : entry.ok === true ? "is-ok"
    : entry.ok === false ? "is-error"
    : "is-working";

  existing.className = `result-card ${newClass}`;

  const badge = existing.querySelector(".result-badge");
  if (badge) {
    badge.className = `result-badge ${entry.working ? "working" : entry.ok ? "ok" : "error"}`;
    badge.textContent = entry.working
      ? t("badge_streaming")
      : entry.ok === true
        ? (entry.latencyMs ? `${entry.latencyMs}ms` : t("badge_done"))
        : t("badge_error");
  }

  const bodyEl = existing.querySelector(".result-body");
  if (bodyEl) {
    const textEl = bodyEl.querySelector(".result-text");
    const atBottom = textEl
      ? textEl.scrollHeight - textEl.scrollTop <= textEl.clientHeight + 20
      : true;
    renderResultBody(bodyEl, entry);
    const nextTextEl = bodyEl.querySelector(".result-text");
    if (atBottom && nextTextEl) nextTextEl.scrollTop = nextTextEl.scrollHeight;
  }

  if (!entry.working && entry.ok !== null) {
    existing.replaceWith(buildCardElement(pid));
  }
}

function escHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderResultBody(container, entry) {
  if (!container) return;

  const images = Array.isArray(entry.images) ? entry.images : [];
  container.innerHTML = "";

  if (images.length > 0) {
    const gallery = document.createElement("div");
    gallery.className = `result-images ${images.length === 1 ? "single" : "multi"}`;

    for (const image of images) {
      const frame = document.createElement("div");
      frame.className = "result-image-frame";

      const img = document.createElement("img");
      img.className = "result-image";
      img.src = image.src;
      img.alt = image.alt || "Generated image";
      img.loading = "lazy";
      frame.appendChild(img);
      gallery.appendChild(frame);
    }

    container.appendChild(gallery);
  }

  const textEl = document.createElement("div");
  textEl.className = "result-text";
  textEl.textContent = entry.text ?? "";
  if (entry.working) {
    const cursor = document.createElement("span");
    cursor.className = "stream-cursor";
    textEl.appendChild(cursor);
  }
  container.appendChild(textEl);
}

function setStatusKey(key, vars = {}, mode = "") {
  state.statusState = { type: "key", key, vars, mode };
  renderStatus();
}

function setStatusRaw(text, mode = "") {
  state.statusState = { type: "raw", text, mode };
  renderStatus();
}

function renderStatus() {
  const status = state.statusState;
  const text = status.type === "key" ? t(status.key, status.vars) : localizeRuntimeText(status.text);
  el.compareStatus.textContent = text;
  el.compareStatus.className = `compare-status ${status.mode ?? ""}`;
}

function showGlobalError(payload) {
  if (!payload) {
    el.globalError.classList.add("hidden");
    el.globalError.innerHTML = "";
    return;
  }

  const localized = localizePayload(payload);
  el.globalError.classList.remove("hidden");
  el.globalError.innerHTML = `
    <div class="global-error-title">${escHtml(localized.title ?? t("global_error_title"))}</div>
    <div class="global-error-detail">${escHtml(localized.detail ?? "")}</div>
    ${localized.hint ? `<div class="global-error-detail">${escHtml(localized.hint)}</div>` : ""}
  `;
}

function localizePayload(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return {
    ...payload,
    title: localizeRuntimeText(payload.title),
    detail: localizeRuntimeText(payload.detail),
    hint: localizeRuntimeText(payload.hint),
    error: localizeRuntimeText(payload.error),
  };
}

function localizeRuntimeText(text) {
  if (!text || typeof text !== "string") return text ?? "";

  const exact = {
    "Quota esaurita": "runtime_quota_title",
    "Sessione browser chiusa": "runtime_session_closed_title",
    "Provider non pronto": "runtime_provider_not_ready_title",
    "Risposta inattesa del sito": "runtime_html_instead_title",
    "Errore temporaneo del provider": "runtime_provider_temp_title",
    "Errore di rete del browser": "runtime_network_title",
    "Errore inatteso": "runtime_unexpected_title",
    "Profilo browser salvato ma sessione non aperta": "runtime_saved_profile_error",
    "Premi Apri login per riaprire il browser sul profilo gia' salvato.": "runtime_saved_profile_hint",
    "Challenge manuale richiesta dal provider": "runtime_manual_challenge_error",
    "Completa captcha o verifica umana nella finestra Playwright, poi premi Verifica.": "runtime_manual_challenge_hint",
    "Il provider sta mostrando una pagina errore temporanea": "runtime_temp_provider_error",
    "Ricarica dalla finestra Playwright o usa Reset e Apri login dopo qualche secondo.": "runtime_temp_provider_hint",
    "Login non ancora completato": "runtime_login_required",
    "Completa il login nella finestra Playwright. Se compare l'account picker Google, scegli lo stesso account usato in precedenza.": "runtime_login_hint",
    "Il sistema tenterà la rotazione automatica a un account di backup, se disponibile.": "runtime_quota_hint",
    "La finestra Playwright o il tab del provider non sono piu' attivi.": "runtime_session_closed_detail",
    "Premi Reset e poi Apri login per ricreare una sessione pulita.": "runtime_session_closed_hint",
    "Il provider e' aperto ma la chat non e' stata riconosciuta.": "runtime_provider_not_ready_detail",
    "Completa login o challenge manuali, poi premi Verifica. Se il sito e' cambiato, aggiorna i selettori del provider.": "runtime_provider_not_ready_hint",
    "Il frontend ha restituito HTML invece del flusso atteso. Di solito significa challenge, redirect o pagina errore.": "runtime_html_instead_detail",
    "Controlla la finestra Playwright: potrebbe esserci login incompleto, captcha o una pagina intermedia.": "runtime_html_instead_hint",
    "Il sito del provider ha risposto con un errore temporaneo.": "runtime_provider_temp_detail",
    "Aspetta qualche secondo e riprova. Se persiste, usa Reset e riapri la sessione.": "runtime_provider_temp_hint",
    "Il browser Playwright non ha completato correttamente la navigazione.": "runtime_network_detail",
    "Verifica connettivita', challenge e redirect del provider, poi riprova.": "runtime_network_hint",
    "Usa Reset per ricreare la sessione se il problema persiste.": "runtime_unexpected_hint",
    "Audio non trovato": "runtime_audio_not_found",
  };

  if (exact[text]) {
    return t(exact[text]);
  }

  const patterns = [
    [/^L'account (.+) ha raggiunto il limite di utilizzo su (.+)\.$/, "runtime_quota_detail", ([, account, provider]) => ({ account, provider })],
    [/^Nessun audio disponibile per (.+)\. Genera prima il read aloud\.$/, "runtime_audio_not_found_detail", ([, provider]) => ({ provider })],
    [/^Tutti gli account per (.+) hanno la quota esaurita\.$/, "runtime_all_accounts_exhausted", ([, provider]) => ({ provider })],
    [/^Provider (.+) non pronto\. Aggiorna providers\.config\.json con i selettori corretti dopo il login\.$/, "runtime_provider_not_ready_generic", ([, provider]) => ({ provider })],
    [/^Input non trovato per (.+)\.$/, "runtime_input_not_found", ([, provider]) => ({ provider })],
    [/^Provider (.+) ha superato il timeout massimo di risposta\.$/, "runtime_timeout_max", ([, provider]) => ({ provider })],
    [/^Provider (.+) non ha iniziato a rispondere entro il timeout iniziale\.$/, "runtime_timeout_first_chunk", ([, provider]) => ({ provider })],
    [/^Provider (.+) non ha prodotto testo utile in risposta\.$/, "runtime_no_useful_text", ([, provider]) => ({ provider })],
    [/^Provider (.+) occupato troppo a lungo; impossibile inviare un nuovo prompt\.$/, "runtime_provider_busy", ([, provider]) => ({ provider })],
    [/^Grok non ha esposto un audio leggibile dopo il click su read aloud\.$/, "runtime_grok_audio_missing", () => ({})],
    [/^Pulsante read aloud di Grok non trovato\.$/, "runtime_grok_audio_button_missing", () => ({})],
  ];

  for (const [pattern, key, varsFn] of patterns) {
    const match = text.match(pattern);
    if (match) {
      return t(key, varsFn(match));
    }
  }

  return text;
}

function updateClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  el.statTime.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

document.addEventListener("keydown", (event) => {
  if (event.target.tagName === "TEXTAREA" || event.target.tagName === "INPUT") {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      if (!state.comparing) runCompare();
    }
    return;
  }

  switch (event.key) {
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
    case "1":
    case "2":
    case "3":
    case "4": {
      const idx = Number.parseInt(event.key, 10) - 1;
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

el.refreshBtn.addEventListener("click", loadOverview);
el.runBtn.addEventListener("click", runCompare);
el.promptInput.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    if (!state.comparing) runCompare();
  }
});
el.helpBtn.addEventListener("click", () => el.helpOverlay.classList.remove("hidden"));
el.helpClose.addEventListener("click", () => el.helpOverlay.classList.add("hidden"));
el.helpOverlay.addEventListener("click", (event) => {
  if (event.target === el.helpOverlay) el.helpOverlay.classList.add("hidden");
});
el.langIt.addEventListener("click", () => setLanguage("it"));
el.langEn.addEventListener("click", () => setLanguage("en"));

setInterval(updateClock, 1000);
updateClock();
applyTranslations();
setStatusKey("system_initializing");

loadOverview().then(() => {
  setStatusKey("system_ready");
  toast(t("boot_toast"), "ok", 2500);

  let bootPolls = 0;
  const bootInterval = setInterval(async () => {
    bootPolls += 1;
    if (bootPolls >= 6) {
      clearInterval(bootInterval);
      return;
    }
    await loadOverview();
    const allSettled = state.providers.every((provider) => provider.status?.ready || (provider.status?.error && provider.status.launched !== undefined));
    if (allSettled) clearInterval(bootInterval);
  }, 3500);
});
