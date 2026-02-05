/* CloudVPS (vanilla) — Firebase RTDB + Worker (GitHub Actions proxy)
   - Options (OS/Language) are synced from workflow inputs via Worker /api/config.
   - Connection info is synced from running action via Worker (webhook -> KV) /api/runs/:id/connection.
   - Firebase RTDB stores users + sessions only.
*/
(() => {
  "use strict";

  // ===== Config =====
  const CFG = {
    redeemPoints: 300,
    sessionSeconds: 6 * 60 * 60,
    tasks: {
      video: { reward: 5, cooldownSec: 45 },
      short: { reward: 2, cooldownSec: 25 },
      daily: { reward: 10 } // UTC daily
    }
  };

  // ===== DOM =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    tabs: $$("[data-tab]"),
    views: $$("[data-view]"),
    bottomTabs: $$(".bn-item"),
    btnOpenAuth: $("#btnOpenAuth"),
    authBtnLabel: $("#authBtnLabel"),

    pointsBalance: $("#pointsBalance"),
    activeTimeLeft: $("#activeTimeLeft"),

    sessionEarned: $("#sessionEarned"),
    sessionTarget: $("#sessionTarget"),
    heroProgressFill: $("#heroProgressFill"),

    statActive: $("#statActive"),
    statTotal: $("#statTotal"),
    statCooldown: $("#statCooldown"),
    statStatus: $("#statStatus"),

    activityList: $("#activityList"),

    // Earn tasks
    taskCards: $$("[data-task]"),

    // Dashboard
    btnCreate: $("#btnCreate"),
    btnCreateEmpty: $("#btnCreateEmpty"),
    btnSyncAll: $("#btnSyncAll"),
    searchSessions: $("#searchSessions"),
    sessionsBody: $("#sessionsBody"),
    sessionsEmpty: $("#sessionsEmpty"),
    sessionsWrap: $("#sessionsWrap"),

    // Settings
    workerBaseUrl: $("#workerBaseUrl"),
    btnSaveWorker: $("#btnSaveWorker"),
    btnTestWorker: $("#btnTestWorker"),
    workerTestResult: $("#workerTestResult"),
    themeButtons: $$("[data-theme]"),
    reduceMotion: $("#reduceMotion"),
    btnExport: $("#btnExport"),
    btnImport: $("#btnImport"),
    btnResetUI: $("#btnResetUI"),

    // Modals
    authModal: $("#authModal"),
    createModal: $("#createModal"),
    connModal: $("#connModal"),

    // Auth forms
    loginForm: $("#loginForm"),
    registerForm: $("#registerForm"),
    loginEmail: $("#loginEmail"),
    loginPassword: $("#loginPassword"),
    regName: $("#regName"),
    regEmail: $("#regEmail"),
    regPassword: $("#regPassword"),
    btnGoogle: $("#btnGoogle"),
    btnGithub: $("#btnGithub"),
    btnLogout: $("#btnLogout"),
    authSubtitle: $("#authSubtitle"),
    meName: $("#meName"),
    meEmail: $("#meEmail"),
    meUid: $("#meUid"),
    mePoints: $("#mePoints"),
    accountBox: $("#accountBox"),
    authTabs: $$("[data-auth-tab]"),

    // Create modal fields
    osSelect: $("#osSelect"),
    langSelect: $("#langSelect"),
    btnCreateConfirm: $("#btnCreateConfirm"),
    createHint: $("#createHint"),

    // Connection modal
    connRdp: $("#connRdp"),
    connWeb: $("#connWeb"),
    connWebOpen: $("#connWebOpen"),
    connUser: $("#connUser"),
    connPass: $("#connPass"),
    btnFetchConn: $("#btnFetchConn"),
    connHint: $("#connHint"),
  };

  // ===== Toast =====
  const toastEl = $("#toast");
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }

  // ===== Utilities =====
  const nf = new Intl.NumberFormat(undefined);
  const now = () => Date.now();

  function utcDateKey(d = new Date()) {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function formatHHMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ===== UI State (local) =====
  const LS_KEY = "cloudvps_ui_v1";
  const uiState = loadUIState();

  function loadUIState() {
    try {
      return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    } catch {
      return {};
    }
  }
  function saveUIState() {
    localStorage.setItem(LS_KEY, JSON.stringify(uiState));
  }

  function getWorkerBase() {
    const v = (uiState.workerBaseUrl || "").trim();
    return v.endsWith("/") ? v.slice(0, -1) : v;
  }

  // ===== Navigation =====
  function setActiveTab(tab) {
    for (const b of el.tabs) b.classList.toggle("is-active", b.dataset.tab === tab);
    for (const b of el.bottomTabs) b.classList.toggle("is-active", b.dataset.tab === tab);
    for (const v of el.views) v.classList.toggle("is-active", v.dataset.view === tab);
    location.hash = `#${tab}`;
  }

  function initNav() {
    const go = (tab) => setActiveTab(tab);

    for (const b of el.tabs) b.addEventListener("click", () => go(b.dataset.tab));
    for (const b of el.bottomTabs) b.addEventListener("click", () => go(b.dataset.tab));
    for (const b of $$("[data-tab-jump]")) b.addEventListener("click", () => go(b.dataset.tabJump));

    const initial = (location.hash || "#home").slice(1);
    if (["home", "earn", "dashboard", "settings"].includes(initial)) setActiveTab(initial);

    window.addEventListener("hashchange", () => {
      const t = (location.hash || "#home").slice(1);
      if (["home", "earn", "dashboard", "settings"].includes(t)) setActiveTab(t);
    });
  }

  // ===== Modal (simple focus) =====
  let lastFocus = null;
  function openModal(m) {
    if (!m) return;
    lastFocus = document.activeElement;
    m.setAttribute("aria-hidden", "false");
    const focusable = m.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
    focusable?.focus?.();
  }
  function closeModal(m) {
    if (!m) return;
    m.setAttribute("aria-hidden", "true");
    lastFocus?.focus?.();
  }
  function wireModals() {
    for (const m of $$(".modal")) {
      m.addEventListener("click", (e) => {
        const t = e.target;
        if (t && (t.matches("[data-close]") || t.closest("[data-close]"))) closeModal(m);
      });
    }
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        for (const m of $$(".modal[aria-hidden='false']")) closeModal(m);
      }
    });
  }

  // ===== Theme / prefs =====
  function applyTheme() {
    const t = uiState.theme || "auto";
    const reduce = !!uiState.reduceMotion;
    el.reduceMotion.checked = reduce;

    let theme = t;
    if (t === "auto") {
      theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", theme === "dark" ? "dark" : "light");

    for (const b of el.themeButtons) b.classList.toggle("is-active", b.dataset.theme === t);

    document.documentElement.style.scrollBehavior = reduce ? "auto" : "smooth";
  }

  function initPrefs() {
    el.workerBaseUrl.value = uiState.workerBaseUrl || "";
    applyTheme();

    for (const b of el.themeButtons) {
      b.addEventListener("click", () => {
        uiState.theme = b.dataset.theme;
        saveUIState();
        applyTheme();
      });
    }
    el.reduceMotion.addEventListener("change", () => {
      uiState.reduceMotion = el.reduceMotion.checked;
      saveUIState();
      applyTheme();
    });

    el.btnSaveWorker.addEventListener("click", () => {
      uiState.workerBaseUrl = el.workerBaseUrl.value.trim();
      saveUIState();
      toast("Saved Worker URL");
    });

    el.btnTestWorker.addEventListener("click", async () => {
      el.workerTestResult.textContent = "Testing…";
      try {
        const res = await api("/api/health");
        el.workerTestResult.textContent = `OK: ${res.status}`;
      } catch (err) {
        el.workerTestResult.textContent = `Error: ${String(err?.message || err)}`;
      }
    });

    el.btnExport.addEventListener("click", async () => {
      const blob = new Blob([JSON.stringify(uiState, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cloudvps-ui-settings.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    el.btnImport.addEventListener("click", async () => {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = async () => {
        const f = inp.files?.[0];
        if (!f) return;
        try {
          const txt = await f.text();
          const obj = JSON.parse(txt);
          Object.assign(uiState, obj || {});
          saveUIState();
          el.workerBaseUrl.value = uiState.workerBaseUrl || "";
          applyTheme();
          toast("Imported settings");
        } catch {
          toast("Invalid settings file");
        }
      };
      inp.click();
    });

    el.btnResetUI.addEventListener("click", () => {
      localStorage.removeItem(LS_KEY);
      location.reload();
    });
  }

  // ===== Worker API wrapper =====
  async function api(path, opts = {}) {
    const base = getWorkerBase();
    const url = `${base}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {})
      }
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`API ${res.status}: ${t || res.statusText}`);
    }
    const ct = res.headers.get("content-type") || "";
    return ct.includes("application/json") ? res.json() : res.text();
  }

  // ===== Firebase RTDB (vanilla compat) =====
  let fb = { ready: false, user: null, db: null };
  let unsubUser = null;
  let unsubVps = null;

  const localFallback = {
    pointsBalance: 0,
    sessions: [],
    daily: { utcDate: utcDateKey(), earned: 0, claimed: "" },
    cooldown: { videoUntil: 0, shortUntil: 0 },
    activity: []
  };

  let model = {
    pointsBalance: 0,
    daily: { utcDate: utcDateKey(), earned: 0, claimed: "" },
    cooldown: { videoUntil: 0, shortUntil: 0 },
    activity: [],
    sessions: []
  };

  function isFirebaseConfigured() {
    return !!window.FIREBASE_CONFIG;
  }

  function initFirebase() {
    if (!isFirebaseConfigured()) {
      renderAuthUnauthed(true);
      toast("Firebase config missing — running in demo mode (no sync).");
      // Demo mode init from localStorage
      hydrateDemo();
      return;
    }

    // wait for compat SDK loaded
    if (!window.firebase?.initializeApp) {
      setTimeout(initFirebase, 50);
      return;
    }

    firebase.initializeApp(window.FIREBASE_CONFIG);

    fb.db = firebase.database();

    firebase.auth().onAuthStateChanged(async (user) => {
      fb.user = user || null;
      fb.ready = true;

      if (!user) {
        detachRealtime();
        renderAuthUnauthed(false);
        // demo points until login
        toast("Logged out.");
        return;
      }

      renderAuthAuthed(user);

      // Ensure user doc
      const uRef = fb.db.ref(`users/${user.uid}`);
      const snap = await uRef.get();
      if (!snap.exists()) {
        await uRef.set({
          displayName: user.displayName || "User",
          email: user.email || "",
          pointsBalance: 0,
          createdAt: now(),
          updatedAt: now()
        });
      } else {
        await uRef.update({ updatedAt: now() });
      }

      attachRealtime(user.uid);
      toast("Synced with Firebase.");
    });
  }

  function detachRealtime() {
    try { unsubUser?.(); } catch {}
    try { unsubVps?.(); } catch {}
    unsubUser = null;
    unsubVps = null;
  }

  function attachRealtime(uid) {
    detachRealtime();

    const uRef = fb.db.ref(`users/${uid}`);
    const vRef = fb.db.ref(`vps/${uid}`);

    const onUser = uRef.on("value", (s) => {
      const v = s.val() || null;
      if (!v) return;
      model.pointsBalance = Number(v.pointsBalance || 0);
      renderTop();
      renderAccountPoints();
    });

    const onVps = vRef.on("value", (s) => {
      const obj = s.val() || {};
      const list = Object.values(obj).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      model.sessions = list.map(normalizeSession);
      renderSessions();
      renderStats();
      renderTop();
    });

    unsubUser = () => uRef.off("value", onUser);
    unsubVps = () => vRef.off("value", onVps);
  }

  function renderAuthUnauthed(isDemo) {
    el.authBtnLabel.textContent = isDemo ? "Demo" : "Login";
    el.authSubtitle.textContent = isDemo ? "Demo mode (no Firebase config)." : "Login to sync your sessions.";
    el.accountBox.classList.add("is-hidden");
    el.loginForm.classList.remove("is-hidden");
    el.registerForm.classList.add("is-hidden");
  }

  function renderAuthAuthed(user) {
    el.authBtnLabel.textContent = "Account";
    el.authSubtitle.textContent = "You're signed in.";
    el.meName.textContent = user.displayName || "User";
    el.meEmail.textContent = user.email || "—";
    el.meUid.textContent = user.uid.slice(0, 6);
    el.accountBox.classList.remove("is-hidden");
    el.loginForm.classList.add("is-hidden");
    el.registerForm.classList.add("is-hidden");
  }

  function renderAccountPoints() {
    el.mePoints.textContent = nf.format(model.pointsBalance);
  }

  // ===== Demo storage (if Firebase missing) =====
  const DEMO_KEY = "cloudvps_demo_v1";
  function hydrateDemo() {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (!raw) {
        localStorage.setItem(DEMO_KEY, JSON.stringify(localFallback));
      }
      const d = JSON.parse(localStorage.getItem(DEMO_KEY) || "{}");
      model.pointsBalance = d.pointsBalance || 0;
      model.sessions = (d.sessions || []).map(normalizeSession);
      model.daily = d.daily || model.daily;
      model.cooldown = d.cooldown || model.cooldown;
      model.activity = d.activity || [];
    } catch {}
    renderAll();
  }
  function persistDemo() {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify({
        pointsBalance: model.pointsBalance,
        sessions: model.sessions,
        daily: model.daily,
        cooldown: model.cooldown,
        activity: model.activity
      }));
    } catch {}
  }

  // ===== Auth UI wiring =====
  function initAuthUI() {
    el.btnOpenAuth.addEventListener("click", () => openModal(el.authModal));

    for (const t of el.authTabs) {
      t.addEventListener("click", () => {
        for (const x of el.authTabs) x.classList.toggle("is-active", x === t);
        const tab = t.dataset.authTab;
        el.loginForm.classList.toggle("is-hidden", tab !== "login");
        el.registerForm.classList.toggle("is-hidden", tab !== "register");
      });
    }

    el.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isFirebaseConfigured()) return toast("Demo mode (no Firebase).");
      try {
        await firebase.auth().signInWithEmailAndPassword(el.loginEmail.value.trim(), el.loginPassword.value);
        closeModal(el.authModal);
      } catch (err) {
        toast(err?.message || "Login failed");
      }
    });

    el.registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!isFirebaseConfigured()) return toast("Demo mode (no Firebase).");
      try {
        const cred = await firebase.auth().createUserWithEmailAndPassword(el.regEmail.value.trim(), el.regPassword.value);
        await cred.user.updateProfile({ displayName: el.regName.value.trim().slice(0, 50) || "User" });
        closeModal(el.authModal);
      } catch (err) {
        toast(err?.message || "Register failed");
      }
    });

    el.btnGoogle.addEventListener("click", async () => {
      if (!isFirebaseConfigured()) return toast("Demo mode (no Firebase).");
      try {
        const p = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().signInWithPopup(p);
        closeModal(el.authModal);
      } catch (err) {
        toast(err?.message || "Google login failed");
      }
    });

    el.btnGithub.addEventListener("click", async () => {
      if (!isFirebaseConfigured()) return toast("Demo mode (no Firebase).");
      try {
        const p = new firebase.auth.GithubAuthProvider();
        await firebase.auth().signInWithPopup(p);
        closeModal(el.authModal);
      } catch (err) {
        toast(err?.message || "GitHub login failed");
      }
    });

    el.btnLogout.addEventListener("click", async () => {
      if (!isFirebaseConfigured()) {
        toast("Demo mode");
        return;
      }
      await firebase.auth().signOut();
      closeModal(el.authModal);
    });
  }

  // ===== Workflow options sync =====
  const workflowOptions = { osOptions: [], osDefault: "", languageOptions: [], languageDefault: "" };

  async function loadWorkflowOptions() {
    // Prefer Worker (source of truth = repo workflow file), fallback to local YAML, fallback built-in.
    const fallback = {
      osOptions: [
        "Windows Server 2025 (Docker - 4vCPU | 8GB RAM)",
        "Windows Server 2022 (Docker - 4vCPU | 8GB RAM)"
      ],
      osDefault: "Windows Server 2025 (Docker - 4vCPU | 8GB RAM)",
      languageOptions: ["English", "Tiếng Việt"],
      languageDefault: "English",
      timeoutMinutes: 360
    };

    try {
      const cfg = await api("/api/config");
      Object.assign(workflowOptions, cfg);
    } catch {
      // Try local file (same dir)
      try {
        const res = await fetch("./WindowsRDP.yml", { cache: "no-store" });
        const txt = await res.text();
        const parsed = parseWorkflowYml(txt);
        Object.assign(workflowOptions, parsed);
      } catch {
        Object.assign(workflowOptions, fallback);
      }
    }

    // fill selects
    fillSelect(el.osSelect, workflowOptions.osOptions, workflowOptions.osDefault);
    fillSelect(el.langSelect, workflowOptions.languageOptions, workflowOptions.languageDefault);
  }

  function fillSelect(selectEl, options, def) {
    selectEl.innerHTML = "";
    for (const opt of options || []) {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      selectEl.appendChild(o);
    }
    if (def && options?.includes(def)) selectEl.value = def;
  }

  function parseWorkflowYml(txt) {
    // targeted parser (for this workflow)
    const getBlock = (name) => {
      const lines = txt.split(/\r?\n/);
      let start = -1;
      let indent = 0;
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^(\s*)([A-Za-z0-9_]+):\s*$/);
        if (m && m[2] === name) {
          start = i;
          indent = m[1].length;
          break;
        }
      }
      if (start < 0) return [];
      const out = [];
      for (let i = start + 1; i < lines.length; i++) {
        const ln = lines[i];
        const leading = (ln.match(/^(\s*)/) || ["", ""])[1].length;
        if (leading <= indent && ln.trim().endsWith(":")) break;
        out.push(ln);
      }
      return out;
    };

    const parseInput = (inputName) => {
      const block = getBlock(inputName);
      let def = "";
      const opts = [];
      let inOpts = false;
      let optIndent = 0;

      for (const ln of block) {
        const mDef = ln.match(/^\s*default:\s*(.+)\s*$/);
        if (mDef) def = stripQuotes(mDef[1].trim());

        const mOpt = ln.match(/^(\s*)options:\s*$/);
        if (mOpt) {
          inOpts = true;
          optIndent = mOpt[1].length;
          continue;
        }
        if (inOpts) {
          const leading = (ln.match(/^(\s*)/) || ["", ""])[1].length;
          if (leading <= optIndent) { inOpts = false; continue; }
          const mItem = ln.trim().match(/^- (.+)$/);
          if (mItem) opts.push(stripQuotes(mItem[1].trim()));
        }
      }
      return { def, opts };
    };

    const os = parseInput("os_version");
    const lang = parseInput("language");

    const timeout = (() => {
      const m = txt.match(/timeout-minutes:\s*(\d+)/);
      return m ? Number(m[1]) : 360;
    })();

    return {
      osOptions: os.opts.length ? os.opts : undefined,
      osDefault: os.def || undefined,
      languageOptions: lang.opts.length ? lang.opts : undefined,
      languageDefault: lang.def || undefined,
      timeoutMinutes: timeout
    };
  }

  function stripQuotes(s) {
    return s.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }

  // ===== Earn tasks (simple) =====
  function initTasks() {
    for (const card of el.taskCards) {
      const type = card.dataset.task;
      const btn = card.querySelector("[data-task-btn]");
      btn.addEventListener("click", () => runTask(type, card));
    }
  }

  function renderTasks() {
    const nowMs = now();
    const today = utcDateKey();
    if (model.daily.utcDate !== today) {
      model.daily = { utcDate: today, earned: 0, claimed: "" };
      if (!isFirebaseConfigured()) persistDemo();
    }

    for (const card of el.taskCards) {
      const type = card.dataset.task;
      const btn = card.querySelector("[data-task-btn]");
      const pill = card.querySelector("[data-task-pill]");
      if (!btn || !pill) continue;

      if (type === "daily") {
        const claimed = model.daily.claimed === today;
        btn.disabled = claimed;
        pill.textContent = claimed ? "Completed" : "Active";
        pill.className = `pill ${claimed ? "pill-soft" : "pill-good"}`;
        continue;
      }

      const until = type === "video" ? model.cooldown.videoUntil : model.cooldown.shortUntil;
      const remain = Math.max(0, until - nowMs);
      if (remain > 0) {
        btn.disabled = true;
        pill.textContent = `Cooldown ${Math.ceil(remain / 1000)}s`;
        pill.className = "pill pill-soft";
      } else {
        btn.disabled = false;
        pill.textContent = "Available";
        pill.className = "pill pill-soft";
      }
    }
  }

  async function runTask(type, card) {
    if (!fb.user && isFirebaseConfigured()) {
      openModal(el.authModal);
      return;
    }

    const btn = card.querySelector("[data-task-btn]");
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Loading…";

    try {
      const today = utcDateKey();
      if (model.daily.utcDate !== today) model.daily = { utcDate: today, earned: 0, claimed: "" };

      if (type === "daily" && model.daily.claimed === today) {
        toast("Daily already claimed.");
        return;
      }

      const nowMs = now();
      if (type === "video" && model.cooldown.videoUntil > nowMs) { toast("Cooldown"); return; }
      if (type === "short" && model.cooldown.shortUntil > nowMs) { toast("Cooldown"); return; }

      await sleep(800 + Math.random() * 500);

      const reward = CFG.tasks[type].reward;
      await addPoints(reward, `Task: ${type}`);

      model.daily.earned += reward;
      if (type === "daily") model.daily.claimed = today;
      if (type === "video") model.cooldown.videoUntil = now() + CFG.tasks.video.cooldownSec * 1000;
      if (type === "short") model.cooldown.shortUntil = now() + CFG.tasks.short.cooldownSec * 1000;

      pushActivity(`${type} +${reward}`, reward);

      if (!isFirebaseConfigured()) persistDemo();
      toast(`+${reward} points`);
    } catch (e) {
      toast(String(e?.message || e));
    } finally {
      btn.textContent = original;
      renderTasks();
      renderTop();
    }
  }

  async function addPoints(delta, reason) {
    if (!isFirebaseConfigured()) {
      model.pointsBalance += delta;
      persistDemo();
      return;
    }
    const uid = fb.user.uid;
    const ref = fb.db.ref(`users/${uid}/pointsBalance`);
    await ref.transaction((cur) => Math.max(0, Number(cur || 0) + delta));
    // ledger optional (keep simple)
  }

  function pushActivity(label, delta) {
    model.activity.unshift({ label, delta, ts: now() });
    model.activity = model.activity.slice(0, 6);
    renderActivity();
  }

  function renderActivity() {
    el.activityList.innerHTML = "";
    const items = model.activity.slice(0, 4);
    if (!items.length) {
      el.activityList.innerHTML = `<li class="mini-item"><span class="mini-dot"></span><span class="muted">No recent activity</span><span class="mini-right">—</span></li>`;
      return;
    }
    for (const it of items) {
      const dot = it.delta >= 0 ? "good" : "bad";
      const li = document.createElement("li");
      li.className = "mini-item";
      li.innerHTML = `<span style="display:flex;align-items:center;gap:10px"><span class="mini-dot ${dot}"></span>${escapeHtml(it.label)}</span><span class="mini-right">${it.delta >= 0 ? "+" : ""}${it.delta}</span>`;
      el.activityList.appendChild(li);
    }
  }

  function escapeHtml(s) {
    return String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  // ===== Sessions (Firebase RTDB) =====
  function normalizeSession(s) {
    const x = { ...s };
    x.id = x.id || x.vpsId || crypto.randomUUID();
    x.createdAt = Number(x.createdAt || now());
    x.updatedAt = Number(x.updatedAt || x.createdAt);
    x.status = x.status || "unknown";
    x.osVersion = x.osVersion || "—";
    x.language = x.language || "—";
    x.timeLeftSec = Number(x.timeLeftSec ?? CFG.sessionSeconds);
    x.lastTickMs = Number(x.lastTickMs ?? x.updatedAt);
    x.expiresAt = Number(x.expiresAt || (x.createdAt + CFG.sessionSeconds * 1000));
    x.runId = x.runId || "";
    x.connection = x.connection || null;
    return x;
  }

  function sessionTimeLeft(s) {
    if (!s) return 0;
    if (s.status === "stopped" || s.status === "canceled" || s.status === "failed" || s.status === "completed") {
      return Math.max(0, Math.floor((s.expiresAt - s.lastTickMs) / 1000));
    }
    // running/provisioning: compute from now
    return Math.max(0, Math.floor((s.expiresAt - now()) / 1000));
  }

  function renderSessions() {
    const q = (el.searchSessions.value || "").trim().toLowerCase();
    const list = model.sessions.filter((s) => {
      if (!q) return true;
      return (s.osVersion || "").toLowerCase().includes(q) || (s.status || "").toLowerCase().includes(q);
    });

    const has = list.length > 0;
    el.sessionsEmpty.style.display = has ? "none" : "block";

    // Desktop table hidden on small screens by CSS; we also render mobile cards in wrap
    el.sessionsBody.innerHTML = "";
    const cards = [];

    for (const s of list) {
      const left = sessionTimeLeft(s);
      const statusPill = statusToPill(s.status);

      // desktop row
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(s.osVersion)}</td>
        <td>${escapeHtml(s.language)}</td>
        <td>${statusPill}</td>
        <td><code>${formatHHMMSS(left)}</code></td>
        <td>${s.runId ? `<code>${escapeHtml(String(s.runId))}</code>` : `<span class="muted">—</span>`}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-secondary btn-sm" data-act="conn" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Connection</button>
          <button class="btn btn-secondary btn-sm" data-act="sync" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Sync</button>
          <button class="btn btn-secondary btn-sm" data-act="stop" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Stop</button>
        </td>
      `;
      el.sessionsBody.appendChild(tr);

      // mobile card
      cards.push(`
        <div class="card glass" style="border-radius:16px; box-shadow:none; margin-top:10px">
          <div class="row between" style="margin-top:0">
            <div style="min-width:0">
              <div class="strong" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(s.osVersion)}</div>
              <div class="muted small">${escapeHtml(s.language)} • ${stripHtml(statusPill)}</div>
            </div>
            <div class="pill pill-soft"><code>${formatHHMMSS(left)}</code></div>
          </div>
          <div class="row" style="flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" data-act="conn" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Connection</button>
            <button class="btn btn-secondary btn-sm" data-act="sync" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Sync</button>
            <button class="btn btn-secondary btn-sm" data-act="stop" data-id="${s.id}" ${s.runId ? "" : "disabled"}>Stop</button>
          </div>
          <div class="muted small" style="margin-top:8px">Run: ${s.runId ? escapeHtml(String(s.runId)) : "—"}</div>
        </div>
      `);
    }

    // Render mobile cards below table wrap (only visible on small screens due to CSS)
    const existing = $("#mobileCards");
    if (existing) existing.remove();
    const div = document.createElement("div");
    div.id = "mobileCards";
    div.innerHTML = cards.join("");
    el.sessionsWrap.appendChild(div);

    // wire actions (event delegation)
    el.sessionsWrap.onclick = (e) => {
      const btn = e.target.closest("button[data-act]");
      if (!btn) return;
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const s = model.sessions.find((x) => x.id === id);
      if (!s) return;

      if (act === "sync") syncSession(s).catch((err) => toast(err.message || String(err)));
      if (act === "stop") stopSession(s).catch((err) => toast(err.message || String(err)));
      if (act === "conn") openConnection(s);
    };
  }

  function stripHtml(html) {
    const d = document.createElement("div");
    d.innerHTML = html;
    return d.textContent || "";
  }

  function statusToPill(status) {
    const s = String(status || "").toLowerCase();
    if (s === "running") return `<span class="pill pill-good">Running</span>`;
    if (s === "provisioning" || s === "queued" || s === "in_progress") return `<span class="pill pill-warn">Provisioning</span>`;
    if (s === "stopped" || s === "canceled") return `<span class="pill pill-soft">Stopped</span>`;
    if (s === "completed") return `<span class="pill pill-soft">Completed</span>`;
    if (s === "failed") return `<span class="pill pill-bad">Failed</span>`;
    return `<span class="pill pill-soft">${escapeHtml(status || "Unknown")}</span>`;
  }

  function renderStats() {
    const total = model.sessions.length;
    const active = model.sessions.filter((s) => s.status === "running" || s.status === "provisioning").length;
    el.statTotal.textContent = String(total);
    el.statActive.textContent = String(active);

    const nowMs = now();
    const cd = Math.max(model.cooldown.videoUntil - nowMs, model.cooldown.shortUntil - nowMs, 0);
    el.statCooldown.textContent = cd > 0 ? `${Math.ceil(cd / 1000)}s` : "—";
    el.statStatus.textContent = fb.user ? "Synced" : (isFirebaseConfigured() ? "Logged out" : "Demo");
  }

  function renderTop() {
    el.pointsBalance.textContent = nf.format(model.pointsBalance);

    el.sessionTarget.textContent = nf.format(CFG.redeemPoints);
    // sessionEarned is local only (per page)
    const earned = Number(uiState.sessionEarned || 0);
    el.sessionEarned.textContent = nf.format(earned);
    const pct = Math.max(0, Math.min(100, (earned / CFG.redeemPoints) * 100));
    el.heroProgressFill.style.width = `${pct}%`;

    // active session time (first running/provisioning)
    const s = model.sessions.find((x) => x.status === "running" || x.status === "provisioning");
    el.activeTimeLeft.textContent = s ? formatHHMMSS(sessionTimeLeft(s)) : "—";
  }

  function renderAll() {
    renderTasks();
    renderActivity();
    renderSessions();
    renderStats();
    renderTop();
  }

  // ===== Create / Sync / Stop using Worker =====
  function requireLoginOrDemo() {
    if (!isFirebaseConfigured()) return true; // demo mode
    if (!fb.user) { openModal(el.authModal); return false; }
    return true;
  }

  async function openCreate() {
    if (!requireLoginOrDemo()) return;
    el.createHint.textContent = "";
    openModal(el.createModal);
  }

  async function createSession() {
    if (!requireLoginOrDemo()) return;
    el.btnCreateConfirm.disabled = true;
    el.createHint.textContent = "Dispatching…";

    try {
      // Points check
      if (model.pointsBalance < CFG.redeemPoints) {
        toast(`Need ${CFG.redeemPoints - model.pointsBalance} more points`);
        return;
      }

      const osVersion = el.osSelect.value;
      const language = el.langSelect.value;

      // Spend points locally first to feel instant, then persist.
      await addPoints(-CFG.redeemPoints, "Redeem session");

      const dispatched = await api("/api/dispatch", {
        method: "POST",
        body: JSON.stringify({ os_version: osVersion, language })
      });

      const session = normalizeSession({
        id: crypto.randomUUID(),
        osVersion,
        language,
        status: "provisioning",
        createdAt: now(),
        updatedAt: now(),
        expiresAt: now() + CFG.sessionSeconds * 1000,
        runId: dispatched.run_id ? String(dispatched.run_id) : "",
        workflowUrl: dispatched.html_url || "",
        timeLeftSec: CFG.sessionSeconds,
        lastTickMs: now()
      });

      await saveSession(session);
      pushActivity("Redeemed session -300", -CFG.redeemPoints);
      uiState.sessionEarned = Number(uiState.sessionEarned || 0) + 0;
      saveUIState();

      toast("Workflow dispatched.");
      closeModal(el.createModal);

      // Try resolve run_id if not immediately available
      if (!session.runId && dispatched.dispatch_id) {
        await resolveRunIdForSession(session.id, dispatched.dispatch_id);
      }
    } catch (err) {
      toast(err?.message || "Create failed");
      // rollback points? (optional)
    } finally {
      el.btnCreateConfirm.disabled = false;
      el.createHint.textContent = "";
      renderAll();
    }
  }

  async function saveSession(session) {
    if (!isFirebaseConfigured()) {
      model.sessions.unshift(session);
      persistDemo();
      renderSessions();
      renderStats();
      return;
    }
    const uid = fb.user.uid;
    await fb.db.ref(`vps/${uid}/${session.id}`).set({
      ...session,
      connection: session.connection || null
    });
  }

  async function patchSession(id, patch) {
    if (!isFirebaseConfigured()) {
      const s = model.sessions.find((x) => x.id === id);
      if (!s) return;
      Object.assign(s, patch, { updatedAt: now() });
      persistDemo();
      renderAll();
      return;
    }
    const uid = fb.user.uid;
    await fb.db.ref(`vps/${uid}/${id}`).update({ ...patch, updatedAt: now() });
  }

  async function resolveRunIdForSession(sessionId, dispatchId) {
    // Poll worker to resolve runId using dispatchId
    el.createHint.textContent = "Resolving run id…";
    for (let i = 0; i < 12; i++) {
      await sleep(1500);
      try {
        const r = await api(`/api/dispatch/${encodeURIComponent(dispatchId)}/resolve`);
        if (r.run_id) {
          await patchSession(sessionId, { runId: String(r.run_id), workflowUrl: r.html_url || "" });
          toast("Run ID resolved.");
          return;
        }
      } catch {}
    }
    toast("Run ID not found yet. You can Sync later.");
  }

  async function syncSession(s) {
    if (!s.runId) return;
    const run = await api(`/api/runs/${encodeURIComponent(s.runId)}`);
    const status = mapRunStatus(run);
    await patchSession(s.id, { status });

    // If completed/stopped, freeze lastTick
    if (status === "stopped" || status === "failed" || status === "completed") {
      await patchSession(s.id, { lastTickMs: now() });
    }

    toast("Synced.");
  }

  function mapRunStatus(run) {
    // GitHub run: status = queued|in_progress|completed ; conclusion = success|failure|cancelled|...
    const st = String(run.status || "").toLowerCase();
    const conc = String(run.conclusion || "").toLowerCase();

    if (st === "queued" || st === "in_progress") return "provisioning";
    if (st === "completed") {
      if (conc === "cancelled") return "stopped";
      if (conc === "failure") return "failed";
      return "completed";
    }
    return "unknown";
  }

  async function stopSession(s) {
    if (!s.runId) return;
    await api(`/api/runs/${encodeURIComponent(s.runId)}/cancel`, { method: "POST" });
    await patchSession(s.id, { status: "stopped", lastTickMs: now() });
    toast("Cancel requested.");
  }

  // ===== Connection modal =====
  let currentConnSession = null;

  function openConnection(s) {
    currentConnSession = s;
    setConnFields(s.connection || null);
    el.connHint.textContent = s.runId ? "Fetching latest connection…" : "No run id.";
    openModal(el.connModal);
    if (s.runId) fetchConnection(s).catch((e) => (el.connHint.textContent = e.message || String(e)));
  }

  function setConnFields(conn) {
    el.connRdp.textContent = conn?.rdp || "—";
    el.connWeb.textContent = conn?.web || "—";
    el.connUser.textContent = conn?.username || "Admin";
    el.connPass.textContent = conn?.password || "Window@123456";
    const href = conn?.web ? (conn.web.startsWith("http") ? conn.web : `http://${conn.web}`) : "#";
    el.connWebOpen.href = href;
  }

  async function fetchConnection(s) {
    if (!s.runId) return;
    el.btnFetchConn.disabled = true;

    try {
      const conn = await api(`/api/runs/${encodeURIComponent(s.runId)}/connection`);
      if (!conn || !conn.rdp) {
        el.connHint.textContent = "Not ready yet. Wait a bit and refresh.";
        return;
      }
      setConnFields(conn);
      el.connHint.textContent = "Ready.";
      await patchSession(s.id, { connection: conn });
      toast("Connection updated.");
    } finally {
      el.btnFetchConn.disabled = false;
    }
  }

  // Copy buttons
  function initCopy() {
    document.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-copy]");
      if (!btn) return;
      const sel = btn.getAttribute("data-copy");
      const t = document.querySelector(sel)?.textContent || "";
      try {
        await navigator.clipboard.writeText(t);
        toast("Copied");
      } catch {
        toast("Copy failed");
      }
    });

    el.btnFetchConn.addEventListener("click", () => {
      if (!currentConnSession) return;
      fetchConnection(currentConnSession).catch((e) => (el.connHint.textContent = e.message || String(e)));
    });
  }

  // ===== Tick (UI only) =====
  function tick() {
    renderTasks();
    renderTop();

    // re-render sessions time left without DB writes
    renderSessions();
  }

  // ===== Wiring =====
  function initDashboard() {
    el.searchSessions.addEventListener("input", renderSessions);
    el.btnCreate.addEventListener("click", openCreate);
    el.btnCreateEmpty.addEventListener("click", openCreate);
    el.btnCreateConfirm.addEventListener("click", createSession);

    el.btnSyncAll.addEventListener("click", async () => {
      const candidates = model.sessions.filter((s) => s.runId);
      if (!candidates.length) return toast("No runs to sync.");
      for (const s of candidates) {
        try { await syncSession(s); } catch {}
        await sleep(250);
      }
      toast("Sync all done.");
    });
  }

  // ===== Init =====
  function init() {
    initNav();
    wireModals();
    initPrefs();
    initAuthUI();
    initTasks();
    initCopy();

    loadWorkflowOptions().catch(() => {});
    el.sessionTarget.textContent = nf.format(CFG.redeemPoints);

    renderAll();

    initDashboard();
    initFirebase();

    setInterval(tick, 1000);
  }

  init();
})();
