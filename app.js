(() => {
  "use strict";

  /* =========================================================
     CloudVPS — Ultimate Vanilla SPA (Tabs + Modals)
     - Frontend-only demo mode (localStorage)
     - Multi-instance VPS (max 3), 1 running at a time
     - Tasks: cooldown, daily UTC reset, offerwall, promo, referral
     - Achievements + notifications
     - Settings: theme/accent/density/motion/sound/tips
     ========================================================= */

  // ---------------------------------------------------------
  // Config
  // ---------------------------------------------------------
  const CFG = {
    storageKey: "cloudvps_app_v3",
    version: 3,

    tickMs: 1000,
    metricsTickMs: 2400,
    toastMs: 2600,

    maxInstances: 3,
    maxRunning: 1,

    tasks: {
      video: { reward: 5, cooldownSec: 45, label: "Watched Ad" },
      short: { reward: 2, cooldownSec: 25, label: "Short Link Completed" },
      daily: { reward: 10, label: "Daily Mission Claimed" },
      checkin: { baseReward: 2, maxBonus: 10, label: "Daily Check-in" },
      offer: { label: "Offerwall Completed" },
    },

    // Chain bonus: watch 3 ads within 15 minutes => +10
    videoChain: { target: 3, withinMs: 15 * 60 * 1000, bonus: 10 },

    simulateDelayMs: { min: 900, max: 1400 },

    plans: {
      free: {
        label: "Free",
        cpu: 1,
        ram: 8,
        disk: 50,
        pointsPerHour: 50,
        badge: "Best value",
      },
      micro: {
        label: "Micro",
        cpu: 1,
        ram: 2,
        disk: 25,
        pointsPerHour: 25,
        badge: "Cheapest",
      },
      pro: {
        label: "Pro",
        cpu: 2,
        ram: 16,
        disk: 100,
        pointsPerHour: 120,
        badge: "Power",
      },
      ultra: {
        label: "Ultra",
        cpu: 4,
        ram: 32,
        disk: 200,
        pointsPerHour: 220,
        badge: "Beast",
      },
    },

    regions: [
      "Singapore",
      "Tokyo",
      "Frankfurt",
      "New York",
      "London",
      "Sydney",
    ],

    images: [
      { id: "ubuntu-22", label: "Ubuntu 22.04 LTS" },
      { id: "debian-12", label: "Debian 12" },
      { id: "alpine-3", label: "Alpine 3" },
      { id: "centos-9", label: "CentOS Stream 9" },
    ],

    promoCodes: {
      BUFFBAN1000: { reward: 1000, once: true, label: "Buff Bẩn Admin" },
      WELCOME50: { reward: 50, once: true, label: "Welcome bonus" },
      BOOST10: { reward: 10, once: false, label: "Small boost" },
      CLOUD25: { reward: 25, once: true, label: "Cloud drop" },
    },

    achievements: [
      {
        id: "first_login",
        ico: "👋",
        title: "Welcome!",
        desc: "Sign in for the first time",
        reward: 10,
        type: "boolean",
      },
      {
        id: "first_earn",
        ico: "💸",
        title: "First earnings",
        desc: "Earn any points",
        reward: 10,
        type: "count",
        key: "lifetimeEarned",
        goal: 1,
      },
      {
        id: "earn_300",
        ico: "🎯",
        title: "Redeem ready",
        desc: "Earn 300 points total",
        reward: 25,
        type: "count",
        key: "lifetimeEarned",
        goal: 300,
      },
      {
        id: "earn_1000",
        ico: "🏆",
        title: "Point hoarder",
        desc: "Earn 1000 points total",
        reward: 50,
        type: "count",
        key: "lifetimeEarned",
        goal: 1000,
      },
      {
        id: "watch_20_ads",
        ico: "▶️",
        title: "Ad runner",
        desc: "Watch 20 video ads",
        reward: 25,
        type: "count",
        key: "videoWatched",
        goal: 20,
      },
      {
        id: "complete_50_links",
        ico: "🔗",
        title: "Link grinder",
        desc: "Complete 50 short links",
        reward: 25,
        type: "count",
        key: "shortCompleted",
        goal: 50,
      },
      {
        id: "streak_3",
        ico: "🔥",
        title: "Warm streak",
        desc: "Reach a 3‑day streak",
        reward: 20,
        type: "count",
        key: "streakCount",
        goal: 3,
      },
      {
        id: "streak_7",
        ico: "🌋",
        title: "On fire",
        desc: "Reach a 7‑day streak",
        reward: 40,
        type: "count",
        key: "streakCount",
        goal: 7,
      },
      {
        id: "first_vps",
        ico: "☁️",
        title: "Cloud citizen",
        desc: "Create your first VPS",
        reward: 30,
        type: "count",
        key: "vpsCreated",
        goal: 1,
      },
      {
        id: "ref_1",
        ico: "🧲",
        title: "Magnet",
        desc: "Get 1 referral",
        reward: 30,
        type: "count",
        key: "referrals",
        goal: 1,
      },
    ],

    views: ["home", "earn", "dashboard", "settings"],
    dashTabs: ["overview", "instances", "analytics", "achievements"],
  };

  // ---------------------------------------------------------
  // DOM helpers
  // ---------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const nf = new Intl.NumberFormat(undefined);

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function randInt(min, max) {
    return Math.floor(min + Math.random() * (max - min + 1));
  }

  function now() {
    return Date.now();
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatHHMMSS(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const hh = pad2(Math.floor(s / 3600));
    const mm = pad2(Math.floor((s % 3600) / 60));
    const ss = pad2(s % 60);
    return `${hh}:${mm}:${ss}`;
  }

  function utcDateKey(d = new Date()) {
    const y = d.getUTCFullYear();
    const m = pad2(d.getUTCMonth() + 1);
    const day = pad2(d.getUTCDate());
    return `${y}-${m}-${day}`;
  }

  function fmtShortTime(ts) {
    try {
      return new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(ts));
    } catch {
      return "";
    }
  }

  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeText(el, text) {
    if (!el) return;
    el.textContent = String(text);
  }

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  // Non-cryptographic hash for demo (NOT secure).
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  function randomIPv4() {
    const a = randInt(11, 223);
    const b = randInt(0, 255);
    const c = randInt(0, 255);
    const d = randInt(1, 254);
    return `${a}.${b}.${c}.${d}`;
  }

  function randomHostname() {
    const a = [
      "nova",
      "nebula",
      "orion",
      "atlas",
      "zen",
      "luna",
      "aero",
      "vertex",
    ];
    const b = ["node", "vps", "edge", "cloud", "core", "spark"];
    return `${a[randInt(0, a.length - 1)]}-${b[randInt(0, b.length - 1)]}-${randInt(10, 99)}`;
  }

  async function copyToClipboard(text) {
    const t = String(text);
    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.top = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        return ok;
      } catch {
        return false;
      }
    }
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------
  // Toast (with optional sound)
  // ---------------------------------------------------------
  const toastHost = $(".toast-host");
  function toast(msg, kind = "info") {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    el.textContent = msg;
    toastHost?.appendChild(el);

    if (app?.meta?.prefs?.sound) {
      tryBeep(kind);
    }

    requestAnimationFrame(() => el.classList.add("show"));
    window.setTimeout(() => {
      el.classList.remove("show");
      window.setTimeout(() => el.remove(), 220);
    }, CFG.toastMs);
  }

  function tryBeep(kind) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = kind === "good" ? 880 : kind === "warn" ? 520 : 700;
      g.gain.value = 0.03;
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.07);
      window.setTimeout(() => ctx.close?.(), 120);
    } catch {
      // ignore
    }
  }

  // ---------------------------------------------------------
  // App storage
  // ---------------------------------------------------------
  function defaultPrefs() {
    return {
      theme: "light", // light | dark | auto
      accent: "blue", // blue | purple | cyan
      density: "comfortable", // comfortable | compact
      reduceMotion: false,
      sound: false,
      tips: true,
    };
  }

  function defaultApp() {
    return {
      version: CFG.version,
      users: {},
      sessions: { currentUserId: null },
      perUser: {},
      meta: {
        createdAt: now(),
        updatedAt: now(),
        prefs: defaultPrefs(),
        onboardingDone: false,
        resetTokens: {},
      },
    };
  }

  function defaultUserData() {
    return {
      pointsBalance: 0,
      lifetime: { earned: 0, spent: 0 },
      daily: {
        utcDate: utcDateKey(),
        earned: 0,
        dailyClaimedUtcDate: "",
        checkinClaimedUtcDate: "",
        streakCount: 0,
        streakLastUtcDate: "",
        videoChainCount: 0,
        videoChainLastMs: 0,
        referralsToday: 0,
      },
      tasks: {
        video: { cooldownUntilMs: 0 },
        short: { cooldownUntilMs: 0 },
      },
      offers: {
        utcDate: utcDateKey(),
        items: [],
        claimed: {},
      },
      stats: {
        logins: 0,
        videoWatched: 0,
        shortCompleted: 0,
        offersCompleted: 0,
        referrals: 0,
        vpsCreated: 0,
      },
      achievements: { unlocked: {}, claimed: {} },
      notifications: [],
      ledger: [],
      vps: { selectedId: null, instances: [] },
      security: { twoFaEnabled: false },
      ui: {
        lastView: "home",
        dashTab: "overview",
        ledgerFilter: "",
        instanceSearch: "",
      },
      promoClaimed: {},
      refCode: "",
    };
  }

  function loadApp() {
    const raw = localStorage.getItem(CFG.storageKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function migrate(appLike) {
    if (!appLike || typeof appLike !== "object") return defaultApp();
    if (!("version" in appLike)) return defaultApp();

    const app = appLike;
    if (!app.meta) app.meta = { createdAt: now(), updatedAt: now() };
    if (!app.meta.prefs) app.meta.prefs = defaultPrefs();
    if (typeof app.meta.onboardingDone !== "boolean")
      app.meta.onboardingDone = false;
    if (!app.meta.resetTokens) app.meta.resetTokens = {};

    if (!app.users) app.users = {};
    if (!app.sessions) app.sessions = { currentUserId: null };
    if (!app.perUser) app.perUser = {};

    // Version bump: try to preserve best-effort.
    app.version = CFG.version;

    // Migrate per-user
    for (const userId of Object.keys(app.users)) {
      if (!app.perUser[userId]) {
        app.perUser[userId] = defaultUserData();
      } else {
        const d = app.perUser[userId];
        if (!d.lifetime) d.lifetime = { earned: 0, spent: 0 };
        if (!d.daily) d.daily = defaultUserData().daily;
        if (!d.tasks) d.tasks = defaultUserData().tasks;
        if (!d.offers) d.offers = defaultUserData().offers;
        if (!d.stats) d.stats = defaultUserData().stats;
        if (!d.achievements) d.achievements = { unlocked: {}, claimed: {} };
        if (!d.notifications) d.notifications = [];
        if (!d.security) d.security = { twoFaEnabled: false };
        if (!d.ui) d.ui = defaultUserData().ui;
        if (!d.promoClaimed) d.promoClaimed = {};
        if (!d.refCode) d.refCode = "";

        // Legacy single VPS -> instances
        if (d.vps && !Array.isArray(d.vps.instances)) {
          const legacy = d.vps;
          const inst = {
            id: uid("vps"),
            name: legacy.hostname || "free-vps",
            plan: legacy.plan || "free",
            region: legacy.region || "Singapore",
            image: legacy.image || "ubuntu-22",
            status: legacy.status || "stopped",
            timeLeftSec: legacy.timeLeftSec || 0,
            lastTickMs: legacy.lastTickMs || now(),
            createdAt: legacy.createdAt || 0,
            ipv4: legacy.ipv4 || "",
            hostname: legacy.hostname || "",
            metrics: legacy.metrics || { cpuPct: 0, ramUsed: 0, diskUsed: 0 },
            history: { cpu: [], ts: [] },
          };
          d.vps = { selectedId: inst.id, instances: [inst] };
        }

        if (!d.vps) d.vps = { selectedId: null, instances: [] };
        if (!Array.isArray(d.vps.instances)) d.vps.instances = [];
        if (!("selectedId" in d.vps)) d.vps.selectedId = null;
      }
    }

    return app;
  }

  let app = migrate(loadApp() ?? defaultApp());

  let persistTimer = null;
  function persistSoon() {
    if (persistTimer) return;
    persistTimer = window.setTimeout(() => {
      persistTimer = null;
      app.meta.updatedAt = now();
      try {
        localStorage.setItem(CFG.storageKey, JSON.stringify(app));
      } catch {
        // ignore quota
      }
    }, 220);
  }

  // ---------------------------------------------------------
  // Current user helpers
  // ---------------------------------------------------------
  function currentUserId() {
    return app.sessions.currentUserId;
  }

  function currentUser() {
    const id = currentUserId();
    if (!id) return null;
    return app.users[id] || null;
  }

  function ensureUserData(userId) {
    if (!app.perUser[userId]) {
      app.perUser[userId] = defaultUserData();
    }
    const d = app.perUser[userId];

    // Ensure ref code
    if (!d.refCode) {
      const part =
        userId.replace(/[^\w]/g, "").slice(-6).toUpperCase() || "XXXXXX";
      d.refCode = `CLOUD-${part}`;
    }

    // Offers seed
    ensureOffers(d);

    // Selected instance fallback
    if (!d.vps.selectedId && d.vps.instances.length > 0) {
      d.vps.selectedId = d.vps.instances[0].id;
    }

    persistSoon();
  }

  function currentData() {
    const id = currentUserId();
    if (!id) return null;
    ensureUserData(id);
    return app.perUser[id];
  }

  // ---------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------
  function applyPrefs() {
    const p = app.meta.prefs || defaultPrefs();
    const root = document.documentElement;

    // theme (auto follows media)
    const theme =
      p.theme === "auto"
        ? matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : p.theme;
    root.dataset.theme = theme;
    root.dataset.accent = p.accent || "blue";
    root.dataset.density = p.density || "comfortable";

    root.classList.toggle("reduce-motion", !!p.reduceMotion);

    // labels
    safeText(ui.themeLabel, theme === "dark" ? "Dark" : "Light");
  }

  // React to OS theme changes when auto
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.(
    "change",
    () => {
      if (app.meta.prefs?.theme === "auto") applyPrefs();
    },
  );

  // ---------------------------------------------------------
  // Level / XP
  // ---------------------------------------------------------
  function xpFromData(d) {
    return Math.max(0, Math.floor(d.lifetime?.earned || 0));
  }

  function levelFromXp(xp) {
    const lvl = Math.floor(Math.sqrt(xp / 100)) + 1;
    const currentBase = (lvl - 1) * (lvl - 1) * 100;
    const nextBase = lvl * lvl * 100;
    const progress =
      nextBase === currentBase
        ? 0
        : (xp - currentBase) / (nextBase - currentBase);
    return {
      level: lvl,
      currentBase,
      nextBase,
      progress: clamp(progress, 0, 1),
    };
  }

  // ---------------------------------------------------------
  // Achievements
  // ---------------------------------------------------------
  function getAchProgress(d, ach) {
    if (ach.type === "boolean") {
      const unlocked = !!d.achievements.unlocked[ach.id];
      return { current: unlocked ? 1 : 0, goal: 1 };
    }

    const key = ach.key;
    const goal = ach.goal || 1;

    let current = 0;
    if (key === "lifetimeEarned") current = d.lifetime.earned;
    else if (key === "streakCount") current = d.daily.streakCount;
    else current = d.stats[key] || 0;

    return { current: Math.max(0, current), goal: Math.max(1, goal) };
  }

  function evaluateAchievements(d) {
    for (const ach of CFG.achievements) {
      if (d.achievements.unlocked[ach.id]) continue;

      const { current, goal } = getAchProgress(d, ach);
      const ok = current >= goal;

      if (ok) {
        d.achievements.unlocked[ach.id] = now();
        pushNotif(d, {
          kind: "good",
          title: `Achievement unlocked: ${ach.title}`,
          body: `Claim +${ach.reward} points.`,
        });
        if (app.meta.prefs?.tips) toast(`Unlocked: ${ach.title}`, "good");
      }
    }
    persistSoon();
  }

  function claimAchievement(d, id) {
    const ach = CFG.achievements.find((a) => a.id === id);
    if (!ach) return;

    if (!d.achievements.unlocked[id]) {
      toast("Not unlocked yet.", "info");
      return;
    }
    if (d.achievements.claimed[id]) {
      toast("Already claimed.", "info");
      return;
    }

    d.achievements.claimed[id] = true;
    addPoints(d, ach.reward, `Achievement: ${ach.title}`, "earn", {
      kind: "achievement",
      id,
    });
    toast(`+${ach.reward} pts claimed`, "good");
    persistSoon();
    renderAll();
  }

  function claimAllAchievements(d) {
    let claimedAny = false;
    for (const ach of CFG.achievements) {
      if (d.achievements.unlocked[ach.id] && !d.achievements.claimed[ach.id]) {
        d.achievements.claimed[ach.id] = true;
        addPoints(d, ach.reward, `Achievement: ${ach.title}`, "earn", {
          kind: "achievement",
          id: ach.id,
        });
        claimedAny = true;
      }
    }
    if (claimedAny) {
      toast("Claimed all available achievements.", "good");
    } else {
      toast("No achievements to claim.", "info");
    }
    persistSoon();
    renderAll();
  }

  // ---------------------------------------------------------
  // Notifications
  // ---------------------------------------------------------
  function pushNotif(d, { title, body, kind = "info" }) {
    const item = { id: uid("n"), ts: now(), title, body, kind, read: false };
    d.notifications.unshift(item);
    d.notifications = d.notifications.slice(0, 60);
    persistSoon();
    renderHeader();
  }

  function unreadCount(d) {
    return d.notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);
  }

  function markAllRead(d) {
    for (const n of d.notifications) n.read = true;
    persistSoon();
    renderAll();
  }

  function clearNotifs(d) {
    d.notifications = [];
    persistSoon();
    renderAll();
  }

  // ---------------------------------------------------------
  // Ledger / Points
  // ---------------------------------------------------------
  function addLedger(d, entry) {
    d.ledger.unshift(entry);
    d.ledger = d.ledger.slice(0, 120);
    persistSoon();
  }

  function addPoints(d, delta, title, type = "earn", meta = {}) {
    const before = d.pointsBalance;
    d.pointsBalance = clamp((d.pointsBalance || 0) + delta, 0, 9_999_999);

    if (delta > 0) {
      d.lifetime.earned += delta;
      d.daily.earned += delta;
    } else if (delta < 0) {
      d.lifetime.spent += Math.abs(delta);
    }

    addLedger(d, {
      id: uid("l"),
      ts: now(),
      title,
      delta,
      type,
      meta,
      balanceAfter: d.pointsBalance,
      balanceBefore: before,
    });

    evaluateAchievements(d);
  }

  function ensureEnoughPoints(d, cost) {
    if (d.pointsBalance >= cost) return true;
    toast(
      `Not enough points. Need ${nf.format(cost - d.pointsBalance)} more.`,
      "warn",
    );
    return false;
  }

  // ---------------------------------------------------------
  // Daily normalization & offers
  // ---------------------------------------------------------
  function normalizeDaily(d) {
    const today = utcDateKey();
    if (d.daily.utcDate !== today) {
      d.daily.utcDate = today;
      d.daily.earned = 0;
      d.daily.dailyClaimedUtcDate = "";
      d.daily.checkinClaimedUtcDate = "";
      d.daily.referralsToday = 0;

      // video chain reset daily
      d.daily.videoChainCount = 0;
      d.daily.videoChainLastMs = 0;

      // offers refresh
      ensureOffers(d, true);

      persistSoon();
      if (app.meta.prefs?.tips) toast("Daily refreshed (00:00 UTC).", "info");
    }

    // Also refresh offers if needed
    ensureOffers(d);
  }

  function generateOffers() {
    const pool = [
      {
        ico: "🧪",
        title: "Install a browser extension",
        reward: 12,
        eta: "2–3 min",
      },
      {
        ico: "📝",
        title: "Complete a quick survey",
        reward: 18,
        eta: "3–4 min",
      },
      {
        ico: "🎮",
        title: "Play a game for 2 minutes",
        reward: 14,
        eta: "2–3 min",
      },
      {
        ico: "📱",
        title: "Open an app landing page",
        reward: 9,
        eta: "1–2 min",
      },
      { ico: "🧩", title: "Solve a tiny puzzle", reward: 11, eta: "1–2 min" },
      { ico: "🛍️", title: "Visit a store page", reward: 8, eta: "1–2 min" },
      { ico: "📺", title: "Watch a longer video", reward: 22, eta: "4–5 min" },
    ];

    // pick 4 unique
    const picks = [];
    const used = new Set();
    while (picks.length < 4) {
      const it = pool[randInt(0, pool.length - 1)];
      const key = it.title;
      if (used.has(key)) continue;
      used.add(key);
      picks.push({
        id: uid("offer"),
        ico: it.ico,
        title: it.title,
        reward: it.reward + randInt(-2, 3),
        eta: it.eta,
      });
    }
    return picks;
  }

  function ensureOffers(d, force = false) {
    const today = utcDateKey();
    if (
      force ||
      d.offers.utcDate !== today ||
      !Array.isArray(d.offers.items) ||
      d.offers.items.length === 0
    ) {
      d.offers.utcDate = today;
      d.offers.items = generateOffers();
      d.offers.claimed = {};
      persistSoon();
    }
  }

  // ---------------------------------------------------------
  // Tasks
  // ---------------------------------------------------------
  function taskCooldownRemainingMs(d, type) {
    const t = d.tasks[type];
    if (!t) return 0;
    return Math.max(0, (t.cooldownUntilMs || 0) - now());
  }

  function computeCheckinReward(d) {
    const streak = d.daily.streakCount || 0;
    const bonus = clamp(streak, 0, CFG.tasks.checkin.maxBonus);
    return CFG.tasks.checkin.baseReward + bonus;
  }

  async function runTask(type) {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    normalizeDaily(d);

    const today = utcDateKey();
    if (type === "daily") {
      if (d.daily.dailyClaimedUtcDate === today) {
        toast("Daily mission already claimed today.", "info");
        return;
      }
    }

    if (type === "checkin") {
      if (d.daily.checkinClaimedUtcDate === today) {
        toast("Check-in already completed today.", "info");
        return;
      }
    }

    if (type === "video" || type === "short") {
      const rem = taskCooldownRemainingMs(d, type);
      if (rem > 0) {
        toast(`Cooldown ${Math.ceil(rem / 1000)}s.`, "info");
        return;
      }
    }

    // UI: set loading on button
    const card = $(`[data-task="${type}"]`);
    const btn = card ? $("[data-task-btn]", card) : null;
    if (btn) setBtnLoading(btn, true, "Loading…");

    await sleep(randInt(CFG.simulateDelayMs.min, CFG.simulateDelayMs.max));

    if (type === "video") {
      addPoints(d, CFG.tasks.video.reward, CFG.tasks.video.label, "earn", {
        kind: "task",
        task: "video",
      });
      d.tasks.video.cooldownUntilMs =
        now() + CFG.tasks.video.cooldownSec * 1000;
      d.stats.videoWatched += 1;

      // chain
      updateVideoChain(d);

      pushNotif(d, {
        kind: "good",
        title: "+5 points",
        body: "Video ad completed.",
      });
      toast("+5 points earned", "good");
    } else if (type === "short") {
      addPoints(d, CFG.tasks.short.reward, CFG.tasks.short.label, "earn", {
        kind: "task",
        task: "short",
      });
      d.tasks.short.cooldownUntilMs =
        now() + CFG.tasks.short.cooldownSec * 1000;
      d.stats.shortCompleted += 1;

      pushNotif(d, {
        kind: "good",
        title: "+2 points",
        body: "Short link verified.",
      });
      toast("+2 points earned", "good");
    } else if (type === "daily") {
      d.daily.dailyClaimedUtcDate = today;
      addPoints(d, CFG.tasks.daily.reward, CFG.tasks.daily.label, "earn", {
        kind: "task",
        task: "daily",
      });
      pushNotif(d, {
        kind: "good",
        title: "+10 points",
        body: "Daily mission claimed.",
      });
      toast("+10 daily points", "good");
    } else if (type === "checkin") {
      // streak logic: consecutive days by UTC date
      const last = d.daily.streakLastUtcDate;
      const yesterday = utcDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
      if (last === yesterday) {
        d.daily.streakCount += 1;
      } else if (last === today) {
        // no-op
      } else {
        d.daily.streakCount = 1;
      }
      d.daily.streakLastUtcDate = today;

      d.daily.checkinClaimedUtcDate = today;

      const reward = computeCheckinReward(d);
      addPoints(d, reward, CFG.tasks.checkin.label, "earn", {
        kind: "task",
        task: "checkin",
        streak: d.daily.streakCount,
      });
      pushNotif(d, {
        kind: "good",
        title: `+${reward} points`,
        body: `Check-in complete. Streak: ${d.daily.streakCount} day(s).`,
      });
      toast(`Check-in +${reward} pts`, "good");
    }

    if (btn) setBtnLoading(btn, false);
    persistSoon();
    renderAll();
  }

  function updateVideoChain(d) {
    const lastMs = d.daily.videoChainLastMs || 0;
    const within = now() - lastMs <= CFG.videoChain.withinMs;

    if (!within) {
      d.daily.videoChainCount = 0;
    }

    d.daily.videoChainCount = (d.daily.videoChainCount || 0) + 1;
    d.daily.videoChainLastMs = now();

    if (d.daily.videoChainCount >= CFG.videoChain.target) {
      d.daily.videoChainCount = 0;
      addPoints(d, CFG.videoChain.bonus, "Video chain bonus", "earn", {
        kind: "bonus",
        task: "videoChain",
      });
      pushNotif(d, {
        kind: "good",
        title: `Chain bonus +${CFG.videoChain.bonus}`,
        body: "Watched 3 ads in time. Bonus granted.",
      });
      toast(`Chain bonus +${CFG.videoChain.bonus} pts`, "good");
    }
  }

  async function completeOffer(offerId) {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    normalizeDaily(d);
    ensureOffers(d);

    if (d.offers.claimed[offerId]) {
      toast("Offer already completed.", "info");
      return;
    }

    const offer = d.offers.items.find((o) => o.id === offerId);
    if (!offer) {
      toast("Offer not found (expired). Refresh offers.", "warn");
      return;
    }

    const btn = $(`[data-offer-id="${offerId}"]`);
    if (btn) setBtnLoading(btn, true, "Verifying…");

    await sleep(
      randInt(CFG.simulateDelayMs.min + 200, CFG.simulateDelayMs.max + 400),
    );

    d.offers.claimed[offerId] = true;
    d.stats.offersCompleted += 1;
    addPoints(
      d,
      offer.reward,
      `${CFG.tasks.offer.label}: ${offer.title}`,
      "earn",
      { kind: "offer", offerId },
    );

    pushNotif(d, {
      kind: "good",
      title: `Offer complete +${offer.reward}`,
      body: offer.title,
    });
    toast(`+${offer.reward} pts`, "good");

    if (btn) setBtnLoading(btn, false);
    persistSoon();
    renderAll();
  }

  // ---------------------------------------------------------
  // Promo / Referral
  // ---------------------------------------------------------
  function redeemPromo(codeRaw) {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    const code = String(codeRaw || "")
      .trim()
      .toUpperCase();
    if (!code) {
      toast("Enter a promo code.", "info");
      return;
    }

    const cfg = CFG.promoCodes[code];
    if (!cfg) {
      toast("Invalid promo code.", "warn");
      return;
    }

    if (cfg.once && d.promoClaimed[code]) {
      toast("This code was already used.", "info");
      return;
    }

    d.promoClaimed[code] = true;
    addPoints(d, cfg.reward, `Promo code: ${code}`, "earn", {
      kind: "promo",
      code,
    });
    pushNotif(d, {
      kind: "good",
      title: `Promo redeemed +${cfg.reward}`,
      body: `${code} — ${cfg.label}`,
    });
    toast(`+${cfg.reward} pts`, "good");

    persistSoon();
    renderAll();
  }

  function simulateReferral() {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    normalizeDaily(d);

    // basic daily limit to keep it reasonable
    if (d.daily.referralsToday >= 5) {
      toast("Referral daily limit reached (demo).", "info");
      return;
    }

    d.daily.referralsToday += 1;
    d.stats.referrals += 1;
    addPoints(d, 30, "Referral bonus", "earn", { kind: "referral" });
    pushNotif(d, {
      kind: "good",
      title: "Referral +30",
      body: "A friend signed up with your code.",
    });
    toast("+30 referral points", "good");

    persistSoon();
    renderAll();
  }

  // ---------------------------------------------------------
  // VPS instances
  // ---------------------------------------------------------
  function planSpec(planId) {
    return CFG.plans[planId] || CFG.plans.free;
  }

  function getSelectedInstance(d) {
    const id = d.vps.selectedId;
    if (!id) return null;
    return d.vps.instances.find((i) => i.id === id) || null;
  }

  function countRunning(d) {
    return d.vps.instances.reduce(
      (acc, i) => acc + (i.status === "running" ? 1 : 0),
      0,
    );
  }

  function otherRunningInstance(d, excludeId) {
    return (
      d.vps.instances.find(
        (i) => i.status === "running" && i.id !== excludeId,
      ) || null
    );
  }

  function selectInstance(d, id) {
    if (!id) return;
    const found = d.vps.instances.find((i) => i.id === id);
    if (!found) return;
    d.vps.selectedId = id;
    persistSoon();
    renderAll();
  }

  function vpsCost(planId, hours) {
    const spec = planSpec(planId);
    const h = Math.max(1, Math.min(24, Number(hours) || 1));
    return Math.max(1, Math.floor(spec.pointsPerHour * h));
  }

  async function createInstanceFromForm(form) {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    normalizeDaily(d);

    if (d.vps.instances.length >= CFG.maxInstances) {
      toast(
        `Max instances reached (${CFG.maxInstances}). Destroy one first.`,
        "warn",
      );
      return;
    }

    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim() || "my-vps";
    const plan = String(fd.get("plan") || "free");
    const region = String(fd.get("region") || CFG.regions[0]);
    const image = String(fd.get("image") || CFG.images[0].id);
    const hours = Math.max(1, Math.min(24, Number(fd.get("hours") || 6)));

    const cost = vpsCost(plan, hours);
    if (!ensureEnoughPoints(d, cost)) return;

    // spend
    addPoints(d, -cost, `Redeemed VPS (${hours}h)`, "spend", {
      kind: "redeem",
      plan,
      hours,
    });

    const inst = {
      id: uid("vps"),
      name: name.slice(0, 24),
      plan,
      region,
      image,
      status: "provisioning",
      timeLeftSec: hours * 3600,
      lastTickMs: now(),
      createdAt: 0,
      ipv4: "",
      hostname: "",
      metrics: { cpuPct: 0, ramUsed: 0, diskUsed: 0 },
      history: { cpu: [], ts: [] },
    };

    d.vps.instances.unshift(inst);
    d.vps.selectedId = inst.id;
    d.stats.vpsCreated += 1;

    pushNotif(d, {
      kind: "info",
      title: "Provisioning VPS…",
      body: `${inst.name} (${planSpec(plan).label})`,
    });
    toast("Provisioning VPS…", "info");

    persistSoon();
    closeModal();
    renderAll();

    await sleep(randInt(CFG.simulateDelayMs.min, CFG.simulateDelayMs.max));

    const runningCount = countRunning(d);
    const canRun = runningCount < CFG.maxRunning;

    inst.status = canRun ? "running" : "stopped";
    inst.createdAt = now();
    inst.ipv4 = randomIPv4();
    inst.hostname = randomHostname();
    inst.lastTickMs = now();

    if (inst.status === "running") {
      toast("VPS is running. Countdown started.", "good");
      pushNotif(d, {
        kind: "good",
        title: "VPS running",
        body: `${inst.name} is live.`,
      });
    } else {
      toast("Created. Start is paused (another instance is running).", "warn");
      pushNotif(d, {
        kind: "warn",
        title: "VPS created (paused)",
        body: "Stop the running instance to start this one.",
      });
    }

    persistSoon();
    renderAll();
  }

  function createOrResumeSelected() {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    const inst = getSelectedInstance(d);
    if (!inst) {
      openModal("createVps");
      return;
    }

    if (inst.status === "provisioning") {
      toast("Provisioning in progress…", "info");
      return;
    }

    if (inst.status === "running") {
      toast("Already running.", "info");
      return;
    }

    if (inst.timeLeftSec <= 0) {
      toast("No time left. Redeem again.", "warn");
      openModal("createVps");
      return;
    }

    const other = otherRunningInstance(d, inst.id);
    if (other) {
      showConfirm({
        title: "Switch running instance?",
        sub: `Only 1 instance can run. Stop “${other.name}” and start “${inst.name}”?`,
        okText: "Switch",
        onConfirm: () => {
          other.status = "stopped";
          other.lastTickMs = now();
          inst.status = "running";
          inst.lastTickMs = now();
          pushNotif(d, {
            kind: "info",
            title: "Switched instance",
            body: `${inst.name} is now running.`,
          });
          toast("Switched running instance.", "good");
          persistSoon();
          renderAll();
        },
      });
      return;
    }

    inst.status = "running";
    inst.lastTickMs = now();
    pushNotif(d, {
      kind: "good",
      title: "VPS resumed",
      body: `${inst.name} is running.`,
    });
    toast("VPS resumed.", "good");
    persistSoon();
    renderAll();
  }

  function stopSelectedWithConfirm() {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }

    const inst = getSelectedInstance(d);
    if (!inst || inst.status !== "running") {
      toast("Selected instance is not running.", "info");
      return;
    }

    showConfirm({
      title: "Stop VPS?",
      sub: "This pauses the timer (time remaining is kept).",
      okText: "Stop",
      onConfirm: () => {
        inst.status = "stopped";
        inst.lastTickMs = now();
        pushNotif(d, {
          kind: "warn",
          title: "VPS stopped",
          body: `${inst.name} timer paused.`,
        });
        toast("VPS stopped.", "warn");
        persistSoon();
        renderAll();
      },
    });
  }

  function openExtendModal() {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }
    const inst = getSelectedInstance(d);
    if (!inst) {
      toast("Create an instance first.", "info");
      openModal("createVps");
      return;
    }
    if (inst.status === "provisioning") {
      toast("Provisioning. Try again soon.", "info");
      return;
    }
    openModal("extendVps");
    recalcExtendCost();
  }

  function destroySelectedWithConfirm() {
    const d = currentData();
    if (!d) {
      toast("Please sign in first.", "warn");
      openAuthModal("login");
      return;
    }
    const inst = getSelectedInstance(d);
    if (!inst) {
      toast("No instance selected.", "info");
      return;
    }

    showConfirm({
      title: "Destroy instance?",
      sub: `This will delete “${inst.name}”. No refunds (demo).`,
      okText: "Destroy",
      onConfirm: () => {
        const idx = d.vps.instances.findIndex((x) => x.id === inst.id);
        if (idx >= 0) d.vps.instances.splice(idx, 1);

        if (d.vps.selectedId === inst.id) {
          d.vps.selectedId = d.vps.instances[0]?.id || null;
        }

        pushNotif(d, {
          kind: "warn",
          title: "Instance destroyed",
          body: inst.name,
        });
        toast("Instance destroyed.", "warn");

        persistSoon();
        renderAll();
      },
    });
  }

  function extendSelected(hours) {
    const d = currentData();
    if (!d) return;

    const inst = getSelectedInstance(d);
    if (!inst) {
      toast("No instance selected.", "info");
      return;
    }

    const h = Math.max(1, Math.min(24, Number(hours) || 1));
    const cost = vpsCost(inst.plan, h);

    if (!ensureEnoughPoints(d, cost)) return;

    addPoints(d, -cost, `Extended time (+${h}h)`, "spend", {
      kind: "extend",
      hours: h,
      inst: inst.id,
    });
    inst.timeLeftSec += h * 3600;
    inst.lastTickMs = now();

    pushNotif(d, {
      kind: "good",
      title: "Time extended",
      body: `${inst.name} +${h}h`,
    });
    toast(`Extended +${h}h`, "good");

    persistSoon();
    renderAll();
  }

  function tickCountdown() {
    const d = currentData();
    if (!d) return;

    normalizeDaily(d);

    const t = now();
    for (const inst of d.vps.instances) {
      if (inst.status !== "running" || inst.timeLeftSec <= 0) continue;

      const deltaMs = t - (inst.lastTickMs || t);
      const passed = Math.floor(deltaMs / 1000);
      if (passed <= 0) continue;

      inst.timeLeftSec = Math.max(0, inst.timeLeftSec - passed);
      inst.lastTickMs = (inst.lastTickMs || t) + passed * 1000;

      if (inst.timeLeftSec <= 0) {
        inst.timeLeftSec = 0;
        inst.status = "stopped";
        pushNotif(d, {
          kind: "warn",
          title: "Time ended",
          body: `${inst.name} stopped.`,
        });
        if (app.meta.prefs?.tips) toast("Time ended. VPS stopped.", "warn");
      }
    }

    persistSoon();
  }

  function tickMetrics() {
    const d = currentData();
    if (!d) return;

    for (const inst of d.vps.instances) {
      const spec = planSpec(inst.plan);

      if (inst.status !== "running") {
        inst.metrics.cpuPct = 0;
        inst.metrics.ramUsed = 0;
        inst.metrics.diskUsed = inst.metrics.diskUsed || spec.disk * 0.6;
        continue;
      }

      const cpu = clamp((inst.metrics.cpuPct || 15) + randInt(-10, 12), 5, 95);
      const ramUsed = clamp(
        (inst.metrics.ramUsed || spec.ram * 0.3) + randInt(-8, 10) / 100,
        0.2,
        spec.ram * 0.92,
      );
      const diskUsed = clamp(
        (inst.metrics.diskUsed || spec.disk * 0.6) + randInt(-5, 7) / 100,
        0.2,
        spec.disk * 0.98,
      );

      inst.metrics.cpuPct = cpu;
      inst.metrics.ramUsed = ramUsed;
      inst.metrics.diskUsed = diskUsed;

      // history for charts
      inst.history.cpu.push(cpu);
      inst.history.ts.push(now());
      if (inst.history.cpu.length > 22) {
        inst.history.cpu.shift();
        inst.history.ts.shift();
      }
    }

    persistSoon();
  }

  // ---------------------------------------------------------
  // UI refs
  // ---------------------------------------------------------
  const ui = {
    // views
    views: $$("[data-view]"),
    tabsTop: $$("[data-tab]", $(".tabs")),
    tabsBottom: $$("[data-tab]", $(".bottom-nav")),
    dashTabBtns: $$("[data-dash-tab]"),
    dashPanels: $$("[data-dash-panel]"),

    // header auth toggle
    whenGuest: $$('[data-when="guest"]'),
    whenAuthed: $$('[data-when="authed"]'),

    // points/time
    pointsBalance: $('[data-ui="pointsBalance"]'),
    pointsBalanceInline: $('[data-ui="pointsBalanceInline"]'),
    pointsBalanceAside: $('[data-ui="pointsBalanceAside"]'),
    pointsBalanceDash: $('[data-ui="pointsBalanceDash"]'),

    timePill: $('[data-ui="timePill"]'),

    redeemTarget: $('[data-ui="redeemTarget"]'),
    redeemTargetAside: $('[data-ui="redeemTargetAside"]'),
    redeemProgressFill: $('[data-ui="redeemProgressFill"]'),
    redeemProgressFillAside: $('[data-ui="redeemProgressFillAside"]'),
    pointsToRedeem: $('[data-ui="pointsToRedeem"]'),
    pointsToRedeemAside: $('[data-ui="pointsToRedeemAside"]'),

    // level
    level: $('[data-ui="level"]'),
    levelAside: $('[data-ui="levelAside"]'),
    levelFill: $('[data-ui="levelFill"]'),
    xp: $('[data-ui="xp"]'),
    xpToNext: $('[data-ui="xpToNext"]'),

    // daily
    earnedToday: $('[data-ui="earnedToday"]'),
    earnedTodayDash: $('[data-ui="earnedTodayDash"]'),
    streakCount: $('[data-ui="streakCount"]'),
    streakCountAside: $('[data-ui="streakCountAside"]'),

    // video chain
    videoChainFill: $('[data-ui="videoChainFill"]'),
    videoChainCount: $('[data-ui="videoChainCount"]'),

    // activity
    activityList: $("#activityList"),
    miniActivity: $("#miniActivity"),
    ledgerFilter: $('[data-ui="ledgerFilter"]'),

    // offers
    offerList: $('[data-ui="offerList"]'),

    // dashboard selected instance
    statusDot: $('[data-ui="statusDot"]'),
    vpsStatus: $('[data-ui="vpsStatus"]'),
    instanceName: $('[data-ui="instanceName"]'),
    planLabel: $('[data-ui="planLabel"]'),
    imageLabel: $('[data-ui="imageLabel"]'),
    timeRemaining: $('[data-ui="timeRemaining"]'),

    cpuPct: $('[data-ui="cpuPct"]'),
    cpuFill: $('[data-ui="cpuFill"]'),
    ramUsed: $('[data-ui="ramUsed"]'),
    ramTotal: $('[data-ui="ramTotal"]'),
    ramFill: $('[data-ui="ramFill"]'),
    diskUsed: $('[data-ui="diskUsed"]'),
    diskTotal: $('[data-ui="diskTotal"]'),
    diskFill: $('[data-ui="diskFill"]'),
    cpuSpark: $('[data-ui="cpuSpark"]'),

    region: $('[data-ui="region"]'),
    ipv4: $('[data-ui="ipv4"]'),
    hostname: $('[data-ui="hostname"]'),
    createdAt: $('[data-ui="createdAt"]'),

    instanceSelect: $('[data-ui="instanceSelect"]'),
    instanceTable: $('[data-ui="instanceTable"]'),
    instanceSearch: $('[data-ui="instanceSearch"]'),

    pointsChart: $('[data-ui="pointsChart"]'),
    cpuChart: $('[data-ui="cpuChart"]'),

    extendHint: $('[data-ui="extendHint"]'),

    // settings
    themeLabel: $('[data-ui="themeLabel"]'),
    themeSelect: $('[data-ui="themeSelect"]'),
    accentSelect: $('[data-ui="accentSelect"]'),
    densitySelect: $('[data-ui="densitySelect"]'),
    reduceMotionToggle: $('[data-ui="reduceMotionToggle"]'),
    soundToggle: $('[data-ui="soundToggle"]'),
    tipsToggle: $('[data-ui="tipsToggle"]'),
    displayNameInput: $('[data-ui="displayNameInput"]'),
    twoFaLabel: $('[data-ui="twoFaLabel"]'),
    appVersion: $('[data-ui="appVersion"]'),

    // auth
    authModal: $('[data-modal="auth"]'),
    authForm: $('[data-ui="authForm"]'),
    authTitle: $('[data-ui="authTitle"]'),
    authSub: $('[data-ui="authSub"]'),
    authNameField: $('[data-ui="authNameField"]'),
    authResetField: $('[data-ui="authResetField"]'),
    authSubmitLabel: $('[data-ui="authSubmitLabel"]'),

    // account
    accountEmail: $('[data-ui="accountEmail"]'),
    avatarText: $('[data-ui="avatarText"]'),
    avatarTextLarge: $('[data-ui="avatarTextLarge"]'),
    userName: $('[data-ui="userName"]'),
    userNameLarge: $('[data-ui="userNameLarge"]'),

    // confirm
    confirmTitle: $('[data-ui="confirmTitle"]'),
    confirmSub: $('[data-ui="confirmSub"]'),
    confirmOkText: $('[data-ui="confirmOkText"]'),

    // notifications
    notifCount: $('[data-ui="notifCount"]'),
    notifList: $('[data-ui="notifList"]'),

    // create vps modal
    createVpsForm: $('[data-ui="createVpsForm"]'),
    createCost: $('[data-ui="createCost"]'),
    createBalance: $('[data-ui="createBalance"]'),
    createSpec: $('[data-ui="createSpec"]'),
    createSubmitBtn: $('[data-ui="createSubmitBtn"]'),

    // extend modal
    extendForm: $('[data-ui="extendForm"]'),
    extendCost: $('[data-ui="extendCost"]'),
    extendBalance: $('[data-ui="extendBalance"]'),
    extendSubmitBtn: $('[data-ui="extendSubmitBtn"]'),

    // ssh modal
    sshHost: $('[data-ui="sshHost"]'),
    sshCmd: $('[data-ui="sshCmd"]'),

    // referral/promo
    refCode: $('[data-ui="refCode"]'),
    refLink: $('[data-ui="refLink"]'),
    promoInput: $('[data-ui="promoInput"]'),
    promoInputModal: $('[data-ui="promoInputModal"]'),

    // achievements
    achList: $('[data-ui="achList"]'),
    achListModal: $('[data-ui="achListModal"]'),

    // cmd palette
    cmdInput: $('[data-ui="cmdInput"]'),
    cmdList: $('[data-ui="cmdList"]'),
  };

  // ---------------------------------------------------------
  // Modals
  // ---------------------------------------------------------
  const modalHost = $(".modal-host");
  let activeModal = null;
  let lastFocus = null;

  function openModal(name) {
    const el = $(`[data-modal="${name}"]`);
    if (!el) return;
    // close any open
    closeModal();

    lastFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    modalHost?.setAttribute("aria-hidden", "false");
    el.hidden = false;
    el.classList.add("is-open");
    activeModal = el;

    // focus first input/button
    const focusable = getFocusable(el);
    focusable[0]?.focus();

    // Render dynamic modal contents
    if (name === "notifications") renderNotifications();
    if (name === "createVps") {
      hydrateCreateModal();
      recalcCreateCost();
    }
    if (name === "extendVps") recalcExtendCost();
    if (name === "ssh") renderSshModal();
    if (name === "achievements") {
      const d = currentData();
      if (d) renderAchievements(d, ui.achListModal);
    }
  }

  function closeModal() {
    if (!activeModal) return;
    activeModal.classList.remove("is-open");
    activeModal.hidden = true;
    activeModal = null;
    modalHost?.setAttribute("aria-hidden", "true");
    if (lastFocus) lastFocus.focus();
  }

  function getFocusable(root) {
    return $$(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      root,
    ).filter(
      (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
    );
  }

  // basic focus trap when a modal is open
  document.addEventListener("keydown", (e) => {
    if (!activeModal) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    if (e.key === "Tab") {
      const focusable = getFocusable(activeModal);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;

      if (e.shiftKey && current === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && current === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  // ---------------------------------------------------------
  // Confirm modal helper
  // ---------------------------------------------------------
  let confirmState = { onConfirm: null };
  function showConfirm({ title, sub, okText = "OK", onConfirm }) {
    safeText(ui.confirmTitle, title);
    safeText(ui.confirmSub, sub);
    safeText(ui.confirmOkText, okText);
    confirmState.onConfirm = onConfirm || null;
    openModal("confirm");
  }

  // ---------------------------------------------------------
  // Buttons loading
  // ---------------------------------------------------------
  function setBtnLoading(btn, loading, label = "Loading…") {
    if (!btn) return;
    btn.disabled = !!loading;
    btn.setAttribute("aria-busy", loading ? "true" : "false");
    if (loading) {
      btn.dataset._label = btn.textContent;
      btn.textContent = label;
    } else {
      if (btn.dataset._label) btn.textContent = btn.dataset._label;
      delete btn.dataset._label;
    }
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------------------------------------------------------
  // Routing
  // ---------------------------------------------------------
  function setActiveView(name, { pushHash = true } = {}) {
    if (!CFG.views.includes(name)) name = "home";

    // guard (earn & dashboard require auth)
    if ((name === "earn" || name === "dashboard") && !currentUserId()) {
      toast("Please sign in to access this tab.", "warn");
      openAuthModal("login");
      name = "home";
    }

    for (const v of ui.views) {
      const isActive = v.getAttribute("data-view") === name;
      v.classList.toggle("is-active", isActive);
      v.hidden = !isActive;
    }

    for (const t of [...ui.tabsTop, ...ui.tabsBottom]) {
      const isActive = t.getAttribute("data-tab") === name;
      t.classList.toggle("is-active", isActive);
      t.setAttribute("aria-current", isActive ? "page" : "false");
    }

    const d = currentData();
    if (d) {
      d.ui.lastView = name;
      persistSoon();
    }

    if (pushHash) history.replaceState(null, "", `#${name}`);

    // always render after navigation
    renderAll();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function routeFromHash() {
    const raw = (location.hash || "").replace("#", "").trim();
    if (CFG.views.includes(raw)) return raw;
    const d = currentData();
    if (d?.ui?.lastView && CFG.views.includes(d.ui.lastView))
      return d.ui.lastView;
    return "home";
  }

  function applyDashTabUI(tab) {
    if (!CFG.dashTabs.includes(tab)) tab = "overview";
    for (const b of ui.dashTabBtns) {
      const isActive = b.getAttribute("data-dash-tab") === tab;
      b.classList.toggle("is-active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    for (const p of ui.dashPanels) {
      const isActive = p.getAttribute("data-dash-panel") === tab;
      p.classList.toggle("is-active", isActive);
      p.hidden = !isActive;
    }
  }

  function setDashTab(tab) {
    if (!CFG.dashTabs.includes(tab)) tab = "overview";

    const d = currentData();
    if (d) {
      d.ui.dashTab = tab;
      persistSoon();
    }

    applyDashTabUI(tab);
    // re-render to keep panels fresh
    renderAll();
  }

  // ---------------------------------------------------------
  // Auth
  // ---------------------------------------------------------
  function openAuthModal(mode = "login") {
    openModal("auth");
    setAuthMode(mode);
  }

  function setAuthMode(mode) {
    const form = ui.authForm;
    if (!form) return;

    // update switch buttons
    for (const btn of $$('[data-action="authMode"]')) {
      const isActive = btn.getAttribute("data-mode") === mode;
      btn.classList.toggle("is-active", isActive);
    }

    const modeInput = $('[name="mode"]', form);
    if (modeInput) modeInput.value = mode;

    // update fields visibility
    ui.authNameField.hidden = mode !== "register";
    ui.authResetField.hidden = mode !== "reset";
    const pwdInput = $('[name="password"]', form);
    if (pwdInput)
      pwdInput.autocomplete =
        mode === "register" ? "new-password" : "current-password";

    safeText(
      ui.authTitle,
      mode === "login"
        ? "Sign in"
        : mode === "register"
          ? "Create account"
          : "Reset password",
    );
    safeText(
      ui.authSubmitLabel,
      mode === "login" ? "Sign in" : mode === "register" ? "Register" : "Reset",
    );

    // change forgot button visibility
    const forgotBtn = $('[data-action="forgotPassword"]', form);
    if (forgotBtn) forgotBtn.hidden = mode !== "login";
  }

  function findUserByEmail(email) {
    const e = String(email).trim().toLowerCase();
    for (const id of Object.keys(app.users)) {
      if (String(app.users[id].email).toLowerCase() === e) return app.users[id];
    }
    return null;
  }

  function loginUser(userId) {
    app.sessions.currentUserId = userId;
    ensureUserData(userId);

    const d = app.perUser[userId];
    d.stats.logins += 1;

    // unlock first_login
    if (!d.achievements.unlocked.first_login) {
      d.achievements.unlocked.first_login = now();
      pushNotif(d, {
        kind: "good",
        title: "Welcome!",
        body: "Achievement unlocked. Claim it in Achievements.",
      });
    }

    persistSoon();
    renderAll();
  }

  function logout() {
    app.sessions.currentUserId = null;
    persistSoon();
    closeModal();
    toast("Logged out.", "info");
    setActiveView("home");
    renderAll();
  }

  function register({ email, password, name }) {
    const e = String(email).trim().toLowerCase();
    if (!validEmail(e)) {
      toast("Invalid email.", "warn");
      return;
    }
    if (String(password).length < 6) {
      toast("Password must be at least 6 chars.", "warn");
      return;
    }
    if (findUserByEmail(e)) {
      toast("Email already registered.", "warn");
      return;
    }

    const id = uid("u");
    app.users[id] = {
      id,
      email: e,
      name:
        String(name || "User")
          .trim()
          .slice(0, 32) || "User",
      passHash: fnv1a(String(password)),
      provider: "email",
      createdAt: now(),
    };
    app.perUser[id] = defaultUserData();
    persistSoon();

    loginUser(id);
    closeModal();
    toast("Account created.", "good");
  }

  function login({ email, password }) {
    const e = String(email).trim().toLowerCase();
    const user = findUserByEmail(e);
    if (!user) {
      toast("No account found.", "warn");
      return;
    }
    if (user.passHash !== fnv1a(String(password))) {
      toast("Wrong password.", "warn");
      return;
    }
    loginUser(user.id);
    closeModal();
    toast("Signed in.", "good");
  }

  function forgotPassword(email) {
    const e = String(email).trim().toLowerCase();
    const user = findUserByEmail(e);
    if (!user) {
      toast("No account found.", "warn");
      return;
    }
    const code = String(randInt(100000, 999999));
    app.meta.resetTokens[e] = { code, expiresAt: now() + 10 * 60 * 1000 };
    persistSoon();
    toast(`Reset code: ${code} (demo)`, "info");
    setAuthMode("reset");
  }

  function resetPassword({ email, code, password }) {
    const e = String(email).trim().toLowerCase();
    const user = findUserByEmail(e);
    if (!user) {
      toast("No account found.", "warn");
      return;
    }
    const tok = app.meta.resetTokens[e];
    if (!tok || tok.expiresAt < now()) {
      toast("Reset code expired. Use Forgot again.", "warn");
      return;
    }
    if (String(code).trim() !== String(tok.code)) {
      toast("Invalid reset code.", "warn");
      return;
    }
    if (String(password).length < 6) {
      toast("New password must be at least 6 chars.", "warn");
      return;
    }

    user.passHash = fnv1a(String(password));
    delete app.meta.resetTokens[e];
    persistSoon();
    toast("Password reset. Please sign in.", "good");
    setAuthMode("login");
  }

  function socialLogin(provider) {
    const prov = provider === "github" ? "github" : "google";
    const id = uid("u");
    const email = `${prov}_${randInt(1000, 9999)}@demo.local`;
    app.users[id] = {
      id,
      email,
      name: prov === "github" ? "GitHub User" : "Google User",
      passHash: "",
      provider: prov,
      createdAt: now(),
    };
    app.perUser[id] = defaultUserData();
    persistSoon();

    loginUser(id);
    closeModal();
    toast(`Signed in with ${prov}.`, "good");
  }

  // ---------------------------------------------------------
  // Settings actions
  // ---------------------------------------------------------
  function setTheme(value) {
    const v = String(value || "light");
    app.meta.prefs.theme = ["light", "dark", "auto"].includes(v) ? v : "light";
    persistSoon();
    applyPrefs();
    renderAll();
  }

  function setAccent(value) {
    const v = String(value || "blue");
    app.meta.prefs.accent = ["blue", "purple", "cyan"].includes(v) ? v : "blue";
    persistSoon();
    applyPrefs();
  }

  function setDensity(value) {
    const v = String(value || "comfortable");
    app.meta.prefs.density = ["comfortable", "compact"].includes(v)
      ? v
      : "comfortable";
    persistSoon();
    applyPrefs();
  }

  function togglePrefBool(key) {
    app.meta.prefs[key] = !app.meta.prefs[key];
    persistSoon();
    applyPrefs();
    renderAll();
  }

  function saveProfile() {
    const u = currentUser();
    const d = currentData();
    if (!u || !d) {
      toast("Sign in to edit profile.", "warn");
      return;
    }
    const name = String(ui.displayNameInput?.value || "")
      .trim()
      .slice(0, 32);
    if (!name) {
      toast("Name cannot be empty.", "warn");
      return;
    }
    u.name = name;
    persistSoon();
    toast("Profile saved.", "good");
    renderAll();
  }

  function toggle2fa() {
    const d = currentData();
    if (!d) {
      toast("Sign in to manage security.", "warn");
      return;
    }
    d.security.twoFaEnabled = !d.security.twoFaEnabled;
    persistSoon();
    toast(
      d.security.twoFaEnabled ? "2FA enabled (demo)." : "2FA disabled (demo).",
      "info",
    );
    renderAll();
  }

  // ---------------------------------------------------------
  // Export / Import / Reset
  // ---------------------------------------------------------
  function exportData() {
    downloadJson("cloudvps-data.json", app);
    toast("Exported JSON.", "good");
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        // Confirm overwrite
        showConfirm({
          title: "Import data?",
          sub: "This will overwrite local data (demo).",
          okText: "Import",
          onConfirm: () => {
            app = migrate(parsed);
            persistSoon();
            closeModal();
            toast("Imported.", "good");
            applyPrefs();
            setActiveView(routeFromHash(), { pushHash: true });
            renderAll();
          },
        });
      } catch {
        toast("Invalid JSON.", "warn");
      }
    };
    reader.readAsText(file);
  }

  function resetApp() {
    showConfirm({
      title: "Reset app?",
      sub: "This clears all local data (demo).",
      okText: "Reset",
      onConfirm: () => {
        localStorage.removeItem(CFG.storageKey);
        app = migrate(defaultApp());
        persistSoon();
        closeModal();
        toast("Reset complete.", "good");
        applyPrefs();
        setActiveView("home");
        renderAll();
      },
    });
  }

  // ---------------------------------------------------------
  // Notifications UI
  // ---------------------------------------------------------
  function renderNotifications() {
    const d = currentData();
    if (!d || !ui.notifList) {
      if (ui.notifList)
        ui.notifList.innerHTML = `<li class="muted small">Login required.</li>`;
      return;
    }

    // Mark read when opened
    for (const n of d.notifications) n.read = true;
    persistSoon();

    const items = d.notifications.slice(0, 40);
    ui.notifList.innerHTML = "";

    if (items.length === 0) {
      ui.notifList.innerHTML = `<li class="muted small">No notifications yet.</li>`;
      renderHeader();
      return;
    }

    for (const n of items) {
      const li = document.createElement("li");
      li.className = `notif ${n.read ? "" : "is-unread"}`.trim();
      const ico = n.kind === "good" ? "✅" : n.kind === "warn" ? "⚠️" : "ℹ️";
      li.innerHTML = `
        <div class="notif__left">
          <div class="notif__ico" aria-hidden="true">${ico}</div>
          <div>
            <div class="notif__title">${escapeHTML(n.title)}</div>
            <div class="notif__body">${escapeHTML(n.body || "")}</div>
          </div>
        </div>
        <div class="notif__meta">${escapeHTML(fmtShortTime(n.ts))}</div>
      `;
      ui.notifList.appendChild(li);
    }

    renderHeader();
  }

  // ---------------------------------------------------------
  // Create / Extend modal helpers
  // ---------------------------------------------------------
  let createModalHydrated = false;
  function hydrateCreateModal() {
    if (createModalHydrated) {
      // still update balance/spec
      recalcCreateCost();
      return;
    }
    const form = ui.createVpsForm;
    if (!form) return;

    const planSel = $('[name="plan"]', form);
    const regionSel = $('[name="region"]', form);
    const imageSel = $('[name="image"]', form);

    if (planSel) {
      planSel.innerHTML = "";
      for (const [id, spec] of Object.entries(CFG.plans)) {
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = `${spec.label} — ${spec.cpu} vCPU • ${spec.ram}GB • ${spec.disk}GB • ${spec.pointsPerHour} pts/h`;
        if (id === "free") opt.selected = true;
        planSel.appendChild(opt);
      }
    }

    if (regionSel) {
      regionSel.innerHTML = "";
      for (const r of CFG.regions) {
        const opt = document.createElement("option");
        opt.value = r;
        opt.textContent = r;
        regionSel.appendChild(opt);
      }
    }

    if (imageSel) {
      imageSel.innerHTML = "";
      for (const img of CFG.images) {
        const opt = document.createElement("option");
        opt.value = img.id;
        opt.textContent = img.label;
        imageSel.appendChild(opt);
      }
    }

    createModalHydrated = true;
  }

  function recalcCreateCost() {
    const d = currentData();
    const form = ui.createVpsForm;
    if (!form) return;

    const fd = new FormData(form);
    const plan = String(fd.get("plan") || "free");
    const hours = Number(fd.get("hours") || 6);
    const cost = vpsCost(plan, hours);

    safeText(ui.createCost, nf.format(cost));
    safeText(ui.createBalance, nf.format(d?.pointsBalance ?? 0));

    const spec = planSpec(plan);
    safeText(
      ui.createSpec,
      `${spec.cpu} vCPU • ${spec.ram}GB RAM • ${spec.disk}GB SSD • ${spec.pointsPerHour} pts/h`,
    );

    if (ui.createSubmitBtn) {
      ui.createSubmitBtn.disabled = !d || d.pointsBalance < cost;
    }
  }

  function recalcExtendCost() {
    const d = currentData();
    if (!d) return;

    const inst = getSelectedInstance(d);
    if (!inst || !ui.extendForm) return;

    const fd = new FormData(ui.extendForm);
    const hours = Number(fd.get("hours") || 1);
    const cost = vpsCost(inst.plan, hours);

    safeText(ui.extendCost, nf.format(cost));
    safeText(ui.extendBalance, nf.format(d.pointsBalance));

    if (ui.extendSubmitBtn) {
      ui.extendSubmitBtn.disabled = d.pointsBalance < cost;
    }
  }

  function renderSshModal() {
    const d = currentData();
    if (!d) return;

    const inst = getSelectedInstance(d);
    if (!inst) return;

    const host = inst.ipv4 || "0.0.0.0";
    safeText(ui.sshHost, host);
    safeText(ui.sshCmd, `ssh root@${host}`);
  }

  // ---------------------------------------------------------
  // Header render (auth, points, notif badge)
  // ---------------------------------------------------------
  function renderHeader() {
    const u = currentUser();
    const d = currentData();

    // auth toggles
    for (const el of ui.whenGuest) el.hidden = !!u;
    for (const el of ui.whenAuthed) el.hidden = !u;

    if (u) {
      const initials = (u.name || "U").trim().slice(0, 1).toUpperCase();
      safeText(ui.avatarText, initials);
      safeText(ui.avatarTextLarge, initials);
      safeText(ui.userName, u.name || "User");
      safeText(ui.userNameLarge, u.name || "User");
      safeText(ui.accountEmail, u.email || "—");
    } else {
      safeText(ui.userName, "User");
      safeText(ui.accountEmail, "—");
    }

    // points
    const points = d ? d.pointsBalance : 0;
    safeText(ui.pointsBalance, nf.format(points));
    safeText(ui.pointsBalanceInline, nf.format(points));
    safeText(ui.pointsBalanceAside, nf.format(points));
    safeText(ui.pointsBalanceDash, nf.format(points));

    // redeem progress (free plan 6h => 300)
    const redeemTarget = CFG.plans.free.pointsPerHour * 6;
    safeText(ui.redeemTarget, nf.format(redeemTarget));
    safeText(ui.redeemTargetAside, nf.format(redeemTarget));

    const need = Math.max(0, redeemTarget - points);
    safeText(ui.pointsToRedeem, nf.format(need));
    safeText(ui.pointsToRedeemAside, nf.format(need));

    const pct = clamp((points / redeemTarget) * 100, 0, 100);
    if (ui.redeemProgressFill) ui.redeemProgressFill.style.width = `${pct}%`;
    if (ui.redeemProgressFillAside)
      ui.redeemProgressFillAside.style.width = `${pct}%`;

    // time pill
    const inst = d ? getSelectedInstance(d) : null;
    safeText(ui.timePill, inst ? formatHHMMSS(inst.timeLeftSec) : "00:00:00");

    // notif badge
    const unread = d ? unreadCount(d) : 0;
    if (ui.notifCount) {
      ui.notifCount.hidden = unread <= 0;
      ui.notifCount.textContent = String(unread);
    }
  }

  // ---------------------------------------------------------
  // Earn view render (tasks, offers, ledger)
  // ---------------------------------------------------------
  function renderTasksUI() {
    const d = currentData();
    const today = utcDateKey();

    for (const card of $$("[data-task]")) {
      const type = card.getAttribute("data-task");
      const btn = $("[data-task-btn]", card);
      const pill = $("[data-task-pill]", card);
      if (!type || !btn || !pill) continue;

      if (!d) {
        btn.disabled = true;
        pill.textContent = "Login required";
        pill.classList.remove("pill-good");
        pill.classList.add("pill-soft");
        continue;
      }

      normalizeDaily(d);

      if (type === "daily") {
        const claimed = d.daily.dailyClaimedUtcDate === today;
        btn.disabled = claimed;
        pill.textContent = claimed ? "Completed" : "Active";
        pill.classList.toggle("pill-good", !claimed);
        pill.classList.toggle("pill-soft", claimed);
        continue;
      }

      if (type === "checkin") {
        const claimed = d.daily.checkinClaimedUtcDate === today;
        btn.disabled = claimed;
        pill.textContent = claimed ? "Completed" : "Available";
        pill.classList.toggle("pill-good", !claimed);
        pill.classList.toggle("pill-soft", claimed);
        continue;
      }

      // cooldown tasks
      const rem = taskCooldownRemainingMs(d, type);
      if (rem > 0) {
        btn.disabled = true;
        pill.textContent = `Cooldown ${Math.ceil(rem / 1000)}s`;
        pill.classList.remove("pill-good");
        pill.classList.add("pill-soft");
      } else {
        btn.disabled = false;
        pill.textContent = "Available";
        pill.classList.remove("pill-good");
        pill.classList.add("pill-soft");
      }
    }

    // video chain meter
    if (d) {
      const count = d.daily.videoChainCount || 0;
      safeText(ui.videoChainCount, String(count));
      const pct = clamp((count / CFG.videoChain.target) * 100, 0, 100);
      if (ui.videoChainFill) ui.videoChainFill.style.width = `${pct}%`;
    } else {
      safeText(ui.videoChainCount, "0");
      if (ui.videoChainFill) ui.videoChainFill.style.width = `0%`;
    }
  }

  function renderOffers() {
    const d = currentData();
    if (!ui.offerList) return;

    if (!d) {
      ui.offerList.innerHTML = `<li class="muted small">Login required.</li>`;
      return;
    }

    normalizeDaily(d);
    ensureOffers(d);

    ui.offerList.innerHTML = "";
    for (const offer of d.offers.items) {
      const claimed = !!d.offers.claimed[offer.id];
      const li = document.createElement("li");
      li.className = "offer";
      li.innerHTML = `
        <div class="offer__left">
          <div class="offer__ico" aria-hidden="true">${escapeHTML(offer.ico)}</div>
          <div>
            <div class="offer__title">${escapeHTML(offer.title)}</div>
            <div class="offer__meta">+${escapeHTML(offer.reward)} pts • ${escapeHTML(offer.eta)} • refresh daily</div>
          </div>
        </div>
        <div class="offer__right">
          <span class="pill ${claimed ? "pill-soft" : "pill-good"}">${claimed ? "Completed" : "Available"}</span>
          <button class="btn ${claimed ? "btn-ghost" : "btn-primary"} btn-sm" type="button"
            data-action="completeOffer" data-offer-id="${escapeHTML(offer.id)}" ${claimed ? "disabled" : ""}>
            ${claimed ? "Done" : "Complete"}
          </button>
        </div>
      `;
      ui.offerList.appendChild(li);
    }
  }

  function renderLedger() {
    const d = currentData();
    const list = ui.activityList;
    if (!list) return;

    if (!d) {
      list.innerHTML = `<li class="muted small">Login required.</li>`;
      if (ui.miniActivity) ui.miniActivity.innerHTML = "";
      return;
    }

    const filter = String(ui.ledgerFilter?.value || d.ui.ledgerFilter || "")
      .trim()
      .toLowerCase();
    d.ui.ledgerFilter = filter;
    persistSoon();

    const items = d.ledger
      .filter((e) => !filter || (e.title || "").toLowerCase().includes(filter))
      .slice(0, 40);

    list.innerHTML = "";
    if (items.length === 0) {
      list.innerHTML = `<li class="muted small">No activity yet.</li>`;
    } else {
      for (const it of items) {
        const sign = it.delta >= 0 ? "+" : "";
        const cls = it.delta >= 0 ? "good" : "warn";
        const li = document.createElement("li");
        li.className = "ledger__item";
        li.innerHTML = `
          <span class="dotx ${cls}" aria-hidden="true"></span>
          <div>
            <strong>${escapeHTML(it.title)}</strong>
            <em>${escapeHTML(fmtShortTime(it.ts))}</em>
          </div>
          <span class="ledger__delta ${cls}">${sign}${nf.format(it.delta)}</span>
        `;
        list.appendChild(li);
      }
    }

    // mini preview
    if (ui.miniActivity) {
      ui.miniActivity.innerHTML = "";
      const mini = d.ledger.slice(0, 4);
      if (mini.length === 0) {
        ui.miniActivity.innerHTML = `<li class="mini-item"><span class="dotx"></span>No recent activity<span class="mini-right">—</span></li>`;
      } else {
        for (const it of mini) {
          const sign = it.delta >= 0 ? "+" : "";
          const dot = it.delta >= 0 ? "good" : "warn";
          const li = document.createElement("li");
          li.className = "mini-item";
          li.innerHTML = `
            <span class="dotx ${dot}" aria-hidden="true"></span>
            ${escapeHTML(it.title)}
            <span class="mini-right">${sign}${nf.format(it.delta)}</span>
          `;
          ui.miniActivity.appendChild(li);
        }
      }
    }
  }

  // ---------------------------------------------------------
  // Dashboard render
  // ---------------------------------------------------------
  function renderDashboard() {
    const d = currentData();

    // earned today
    safeText(ui.earnedToday, nf.format(d?.daily.earned || 0));
    safeText(ui.earnedTodayDash, nf.format(d?.daily.earned || 0));

    // streak
    safeText(ui.streakCount, nf.format(d?.daily.streakCount || 0));
    safeText(ui.streakCountAside, nf.format(d?.daily.streakCount || 0));

    // level
    const xp = d ? xpFromData(d) : 0;
    const { level, nextBase, progress } = levelFromXp(xp);
    safeText(ui.level, nf.format(level));
    safeText(ui.levelAside, nf.format(level));
    safeText(ui.xp, nf.format(xp));
    safeText(ui.xpToNext, nf.format(Math.max(0, nextBase - xp)));
    if (ui.levelFill)
      ui.levelFill.style.width = `${Math.round(progress * 100)}%`;

    if (!d) {
      // clear dashboard fields
      safeText(ui.vpsStatus, "Stopped");
      safeText(ui.instanceName, "—");
      safeText(ui.planLabel, "Plan: —");
      safeText(ui.imageLabel, "—");
      safeText(ui.timeRemaining, "00:00:00");
      safeText(ui.region, "—");
      safeText(ui.ipv4, "—");
      safeText(ui.hostname, "—");
      safeText(ui.createdAt, "—");
      return;
    }

    normalizeDaily(d);
    ensureOffers(d);

    // selected instance
    const inst = getSelectedInstance(d);

    // instance select dropdown
    if (ui.instanceSelect) {
      ui.instanceSelect.innerHTML = "";
      if (d.vps.instances.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No instances";
        ui.instanceSelect.appendChild(opt);
        ui.instanceSelect.disabled = true;
      } else {
        ui.instanceSelect.disabled = false;
        for (const i of d.vps.instances) {
          const opt = document.createElement("option");
          opt.value = i.id;
          opt.textContent = `${i.name} • ${planSpec(i.plan).label} • ${i.status}`;
          if (i.id === d.vps.selectedId) opt.selected = true;
          ui.instanceSelect.appendChild(opt);
        }
      }
    }

    if (!inst) {
      safeText(ui.vpsStatus, "No instance");
      safeText(ui.instanceName, "—");
      safeText(ui.planLabel, "Plan: —");
      safeText(ui.imageLabel, "—");
      safeText(ui.timeRemaining, "00:00:00");
      safeText(ui.region, "—");
      safeText(ui.ipv4, "—");
      safeText(ui.hostname, "—");
      safeText(ui.createdAt, "—");
      renderInstanceTable(d);
      renderCharts(d);
      renderAchievements(d);
      return;
    }

    // status
    const statusText =
      inst.status === "running"
        ? "Running"
        : inst.status === "provisioning"
          ? "Provisioning"
          : "Stopped";
    safeText(ui.vpsStatus, statusText);
    safeText(ui.instanceName, inst.name);
    safeText(ui.planLabel, `Plan: ${planSpec(inst.plan).label}`);
    safeText(
      ui.imageLabel,
      CFG.images.find((x) => x.id === inst.image)?.label || inst.image,
    );

    // status dot
    if (ui.statusDot) {
      ui.statusDot.classList.toggle("running", inst.status === "running");
      ui.statusDot.classList.toggle(
        "provisioning",
        inst.status === "provisioning",
      );
      ui.statusDot.classList.toggle("stopped", inst.status === "stopped");
    }

    // time
    safeText(ui.timeRemaining, formatHHMMSS(inst.timeLeftSec));
    safeText(ui.timePill, formatHHMMSS(inst.timeLeftSec));

    // resources
    const spec = planSpec(inst.plan);
    safeText(ui.ramTotal, spec.ram);
    safeText(ui.diskTotal, spec.disk);

    const cpu = inst.metrics.cpuPct || 0;
    safeText(ui.cpuPct, `${Math.round(cpu)}%`);
    if (ui.cpuFill) ui.cpuFill.style.width = `${clamp(cpu, 0, 100)}%`;

    const ramUsed = inst.metrics.ramUsed || 0;
    safeText(ui.ramUsed, ramUsed.toFixed(1));
    if (ui.ramFill)
      ui.ramFill.style.width = `${clamp((ramUsed / spec.ram) * 100, 0, 100)}%`;

    const diskUsed = inst.metrics.diskUsed || 0;
    safeText(ui.diskUsed, diskUsed.toFixed(1));
    if (ui.diskFill)
      ui.diskFill.style.width = `${clamp((diskUsed / spec.disk) * 100, 0, 100)}%`;

    // system info
    safeText(ui.region, inst.region);
    safeText(ui.ipv4, inst.ipv4 || "—");
    safeText(ui.hostname, inst.hostname || "—");
    safeText(
      ui.createdAt,
      inst.createdAt ? new Date(inst.createdAt).toLocaleString() : "—",
    );

    // extend hint based on plan
    const extendCost = vpsCost(inst.plan, 1);
    safeText(ui.extendHint, `Extend: ${extendCost} pts / +1h`);

    // sparkline
    renderSparkline(inst);

    // instances table + charts + achievements
    renderInstanceTable(d);
    renderCharts(d);
    renderAchievements(d);
  }

  function renderSparkline(inst) {
    const svg = ui.cpuSpark;
    if (!svg) return;

    const values = inst.history.cpu || [];
    if (!values.length) {
      svg.innerHTML = "";
      return;
    }

    const w = 120,
      h = 36;
    const minV = 0,
      maxV = 100;

    const pts = values.map((v, idx) => {
      const x = (idx / Math.max(1, values.length - 1)) * (w - 2) + 1;
      const y = h - ((v - minV) / (maxV - minV)) * (h - 4) - 2;
      return [x, clamp(y, 2, h - 2)];
    });

    let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;
    }

    svg.innerHTML = `
      <path d="${d}" fill="none" stroke="url(#sparkGrad)" stroke-width="2.6" stroke-linecap="round" />
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
          <stop stop-color="#3B82F6" />
          <stop offset="0.55" stop-color="#8B5CF6" />
          <stop offset="1" stop-color="#22D3EE" />
        </linearGradient>
      </defs>
    `;
  }

  function renderInstanceTable(d) {
    if (!ui.instanceTable) return;

    const q = String(ui.instanceSearch?.value || d.ui.instanceSearch || "")
      .trim()
      .toLowerCase();
    d.ui.instanceSearch = q;
    persistSoon();

    const items = d.vps.instances
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          planSpec(i.plan).label.toLowerCase().includes(q) ||
          i.region.toLowerCase().includes(q),
      )
      .slice(0, 20);

    ui.instanceTable.innerHTML = "";
    if (items.length === 0) {
      ui.instanceTable.innerHTML = `<div class="muted small" style="padding:14px">No instances.</div>`;
      return;
    }

    for (const i of items) {
      const row = document.createElement("div");
      row.className =
        `table__row ${i.id === d.vps.selectedId ? "is-active" : ""}`.trim();
      const st =
        i.status === "running"
          ? "Running"
          : i.status === "provisioning"
            ? "Provisioning"
            : "Stopped";
      row.setAttribute("role", "row");
      row.setAttribute("data-action", "selectInstanceRow");
      row.setAttribute("data-id", i.id);

      const canStart =
        i.status !== "running" &&
        i.status !== "provisioning" &&
        i.timeLeftSec > 0;
      const startLabel = i.status === "running" ? "Running" : "Start";
      const stopLabel = i.status === "running" ? "Stop" : "—";

      row.innerHTML = `
        <div role="cell">
          <strong>${escapeHTML(i.name)}</strong>
          <div class="muted small">${escapeHTML(i.hostname || "—")}</div>
        </div>
        <div role="cell">${escapeHTML(planSpec(i.plan).label)}</div>
        <div role="cell">${escapeHTML(i.region)}</div>
        <div role="cell"><span class="pill ${i.status === "running" ? "pill-good" : "pill-soft"}">${escapeHTML(st)}</span></div>
        <div role="cell" class="mono">${escapeHTML(formatHHMMSS(i.timeLeftSec))}</div>
        <div role="cell" class="ta-right">
          <button class="btn btn-secondary btn-sm" type="button" data-action="instanceStart" data-id="${escapeHTML(i.id)}" ${canStart ? "" : "disabled"}>${escapeHTML(startLabel)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="instanceStop" data-id="${escapeHTML(i.id)}" ${i.status === "running" ? "" : "disabled"}>${escapeHTML(stopLabel)}</button>
          <button class="btn btn-ghost btn-sm" type="button" data-action="instanceDestroy" data-id="${escapeHTML(i.id)}">Destroy</button>
        </div>
      `;
      ui.instanceTable.appendChild(row);
    }
  }

  function renderCharts(d) {
    renderPointsChart(d);
    renderCpuChart(d);
  }

  function renderPointsChart(d) {
    if (!ui.pointsChart) return;

    // last 7 UTC days
    const days = [];
    const today = new Date();
    for (let k = 6; k >= 0; k--) {
      const dt = new Date(today.getTime() - k * 24 * 60 * 60 * 1000);
      days.push(utcDateKey(dt));
    }

    const earnedByDay = {};
    for (const key of days) earnedByDay[key] = 0;

    for (const e of d.ledger) {
      if (e.delta <= 0) continue;
      const day = utcDateKey(new Date(e.ts));
      if (day in earnedByDay) earnedByDay[day] += e.delta;
    }

    const values = days.map((k) => earnedByDay[k]);
    const max = Math.max(10, ...values);
    ui.pointsChart.innerHTML = "";

    for (let i = 0; i < days.length; i++) {
      const v = values[i];
      const bar = document.createElement("div");
      bar.className = "chart__bar";
      bar.title = `${days[i]}: ${v} pts`;
      const hPct = clamp((v / max) * 100, 2, 100);

      const span = document.createElement("span");
      span.style.height = `${hPct}%`;

      const em = document.createElement("em");
      em.textContent = days[i].slice(5);

      bar.appendChild(span);
      bar.appendChild(em);
      ui.pointsChart.appendChild(bar);
    }
  }

  function renderCpuChart(d) {
    if (!ui.cpuChart) return;

    const inst = getSelectedInstance(d);
    if (!inst || !inst.history.cpu.length) {
      ui.cpuChart.innerHTML = `<div class="muted small">No data yet. Start the instance to generate metrics.</div>`;
      return;
    }

    const values = inst.history.cpu;
    const w = 560;
    const h = 220;
    const pad = 16;

    const minV = 0,
      maxV = 100;

    const pts = values.map((v, idx) => {
      const x = pad + (idx / Math.max(1, values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - minV) / (maxV - minV)) * (h - pad * 2);
      return [x, clamp(y, pad, h - pad)];
    });

    let dPath = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
    for (let i = 1; i < pts.length; i++)
      dPath += ` L ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)}`;

    const svg = `
      <svg class="chart__svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="cpuGrad" x1="0" y1="0" x2="1" y2="0">
            <stop stop-color="#3B82F6" />
            <stop offset="0.55" stop-color="#8B5CF6" />
            <stop offset="1" stop-color="#22D3EE" />
          </linearGradient>
        </defs>

        <path d="${dPath}" fill="none" stroke="url(#cpuGrad)" stroke-width="4" stroke-linecap="round" />
      </svg>
    `;

    ui.cpuChart.innerHTML = svg;
  }

  // ---------------------------------------------------------
  // Achievements UI
  // ---------------------------------------------------------
  function renderAchievements(d, rootEl = ui.achList) {
    if (!rootEl) return;

    evaluateAchievements(d);

    rootEl.innerHTML = "";
    for (const ach of CFG.achievements) {
      const unlocked = !!d.achievements.unlocked[ach.id];
      const claimed = !!d.achievements.claimed[ach.id];

      const { current, goal } = getAchProgress(d, ach);
      const pct = clamp((current / goal) * 100, 0, 100);

      const el = document.createElement("div");
      el.className =
        `ach ${claimed ? "is-claimed" : unlocked ? "is-unlocked" : "is-locked"}`.trim();

      el.innerHTML = `
        <div class="ach__top">
          <div style="display:flex; gap:12px; align-items:flex-start">
            <div class="ach__ico" aria-hidden="true">${escapeHTML(ach.ico)}</div>
            <div>
              <div class="ach__title">${escapeHTML(ach.title)}</div>
              <div class="ach__desc">${escapeHTML(ach.desc)}</div>
            </div>
          </div>
          <span class="pill ${claimed ? "pill-soft" : unlocked ? "pill-good" : "pill-soft"}">${claimed ? "Claimed" : unlocked ? "Unlocked" : "Locked"}</span>
        </div>

        <div class="ach__bar" aria-hidden="true"><i style="width:${pct}%"></i></div>

        <div class="ach__meta">
          <span>${Math.min(current, goal)}/${goal}</span>
          <span>Reward: +${ach.reward}</span>
        </div>

        <div class="row row--end">
          <button class="btn btn-primary btn-sm" type="button" data-action="claimAchievement" data-id="${escapeHTML(ach.id)}"
            ${unlocked && !claimed ? "" : "disabled"}>
            Claim
          </button>
        </div>
      `;
      rootEl.appendChild(el);
    }
  }

  // ---------------------------------------------------------
  // Settings render
  // ---------------------------------------------------------
  function renderSettings() {
    safeText(ui.appVersion, `v${CFG.version}`);

    const p = app.meta.prefs;
    if (ui.themeSelect) ui.themeSelect.value = p.theme;
    if (ui.accentSelect) ui.accentSelect.value = p.accent;
    if (ui.densitySelect) ui.densitySelect.value = p.density;
    if (ui.reduceMotionToggle) ui.reduceMotionToggle.checked = !!p.reduceMotion;
    if (ui.soundToggle) ui.soundToggle.checked = !!p.sound;
    if (ui.tipsToggle) ui.tipsToggle.checked = !!p.tips;

    const d = currentData();
    if (ui.displayNameInput) {
      ui.displayNameInput.value = currentUser()?.name || "";
      ui.displayNameInput.disabled = !d;
    }

    if (ui.twoFaLabel) {
      ui.twoFaLabel.textContent = d?.security.twoFaEnabled
        ? "Disable 2FA"
        : "Enable 2FA";
    }
  }

  // ---------------------------------------------------------
  // Command palette
  // ---------------------------------------------------------
  const commands = [
    {
      id: "goHome",
      title: "Go to Home",
      sub: "Landing view",
      run: () => setActiveView("home"),
    },
    {
      id: "goEarn",
      title: "Go to Earn",
      sub: "Tasks & rewards",
      run: () => setActiveView("earn"),
    },
    {
      id: "goDashboard",
      title: "Go to Dashboard",
      sub: "VPS management",
      run: () => setActiveView("dashboard"),
    },
    {
      id: "goSettings",
      title: "Go to Settings",
      sub: "Personalize UI",
      run: () => setActiveView("settings"),
    },
    {
      id: "openAuth",
      title: "Login / Register",
      sub: "Sign in",
      run: () => openAuthModal("login"),
    },
    {
      id: "openNotifications",
      title: "Notifications",
      sub: "Open inbox",
      run: () => openModal("notifications"),
    },
    {
      id: "openCreateVps",
      title: "Create VPS",
      sub: "Redeem points",
      run: () => openModal("createVps"),
    },
    {
      id: "resumeVps",
      title: "Start/Resume selected",
      sub: "Begin countdown",
      run: () => createOrResumeSelected(),
    },
    {
      id: "extendVps",
      title: "Extend selected",
      sub: "Add hours using points",
      run: () => openExtendModal(),
    },
    {
      id: "stopVps",
      title: "Stop selected",
      sub: "Pause timer",
      run: () => stopSelectedWithConfirm(),
    },
    {
      id: "openSsh",
      title: "SSH",
      sub: "Copy connection commands",
      run: () => openModal("ssh"),
    },
    {
      id: "openAchievements",
      title: "Achievements",
      sub: "Claim rewards",
      run: () => openModal("achievements"),
    },
    {
      id: "exportData",
      title: "Export data",
      sub: "Download JSON",
      run: () => exportData(),
    },
    {
      id: "openHelp",
      title: "Help & shortcuts",
      sub: "Keyboard",
      run: () => openModal("help"),
    },
    {
      id: "toggleTheme",
      title: "Toggle theme",
      sub: "Light/Dark",
      run: () => toggleTheme(),
    },
  ];

  function renderCmdList(filter = "") {
    const q = String(filter || "")
      .trim()
      .toLowerCase();
    const list = ui.cmdList;
    if (!list) return;

    list.innerHTML = "";

    const items = commands.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)
      );
    });

    if (items.length === 0) {
      list.innerHTML = `<li class="muted small" style="padding:10px 6px">No matches</li>`;
      return;
    }

    for (const c of items) {
      const li = document.createElement("li");
      li.className = "cmd__item";
      li.innerHTML = `
        <button class="cmd__btn" type="button" data-action="runCmd" data-id="${escapeHTML(c.id)}">
          <div class="cmd__title">${escapeHTML(c.title)}</div>
          <div class="cmd__sub muted">${escapeHTML(c.sub)}</div>
        </button>
      `;
      list.appendChild(li);
    }
  }

  function openCommandPalette() {
    openModal("cmd");
    renderCmdList("");
    if (ui.cmdInput) {
      ui.cmdInput.value = "";
      ui.cmdInput.focus();
    }
  }

  function runCommand(id) {
    const c = commands.find((x) => x.id === id);
    if (!c) return;
    closeModal();
    c.run();
  }

  // ---------------------------------------------------------
  // Theme toggle quick
  // ---------------------------------------------------------
  function toggleTheme() {
    const current = document.documentElement.dataset.theme || "light";
    // If prefs set to auto, switch to explicit opposite
    if (app.meta.prefs.theme === "auto") {
      app.meta.prefs.theme = current === "dark" ? "light" : "dark";
    } else {
      app.meta.prefs.theme = app.meta.prefs.theme === "dark" ? "light" : "dark";
    }
    persistSoon();
    applyPrefs();
    toast(`Theme: ${document.documentElement.dataset.theme}`, "info");
  }

  // ---------------------------------------------------------
  // Events (click / submit / change / keyboard)
  // ---------------------------------------------------------
  document.addEventListener("click", async (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;

    // import JSON (file input)
    if (
      target.matches('[data-action="importData"]') &&
      target instanceof HTMLInputElement
    ) {
      const file = target.files && target.files[0];
      if (file) importData(file);
      target.value = "";
      return;
    }

    // close modal
    const close = target.closest('[data-action="closeModal"]');
    if (close) {
      e.preventDefault();
      closeModal();
      return;
    }

    // tabs
    const tabBtn = target.closest("[data-tab]");
    if (tabBtn) {
      const tab = tabBtn.getAttribute("data-tab") || "home";
      setActiveView(tab);
      return;
    }

    // dashboard tab
    const dashBtn = target.closest("[data-dash-tab]");
    if (dashBtn) {
      const tab = dashBtn.getAttribute("data-dash-tab") || "overview";
      setDashTab(tab);
      return;
    }

    // tasks
    const taskBtn = target.closest("[data-task-btn]");
    if (taskBtn) {
      const card = taskBtn.closest("[data-task]");
      const type = card?.getAttribute("data-task");
      if (type) runTask(type);
      return;
    }

    // actions
    const actionEl = target.closest("[data-action]");
    if (!actionEl) return;
    const action = actionEl.getAttribute("data-action");
    if (!action) return;

    switch (action) {
      case "goHome":
        setActiveView("home");
        break;
      case "goEarn":
        setActiveView("earn");
        break;
      case "goDashboard":
        setActiveView("dashboard");
        break;
      case "goSettings":
        setActiveView("settings");
        break;

      case "openAuth":
        openAuthModal("login");
        break;
      case "openAccount":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("account");
        break;

      case "openHelp":
        openModal("help");
        break;

      case "openCommandPalette":
        openCommandPalette();
        break;

      case "openNotifications":
        if (!currentUserId()) {
          toast("Sign in to see notifications.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("notifications");
        break;

      case "markAllRead": {
        const d = currentData();
        if (d) markAllRead(d);
        break;
      }
      case "clearNotifs": {
        const d = currentData();
        if (d) clearNotifs(d);
        break;
      }

      case "authMode": {
        const mode = actionEl.getAttribute("data-mode") || "login";
        setAuthMode(mode);
        break;
      }
      case "forgotPassword": {
        const form = ui.authForm;
        if (!form) break;
        const email = String(new FormData(form).get("email") || "");
        forgotPassword(email);
        break;
      }

      case "logout":
        logout();
        break;

      case "exportData":
        exportData();
        break;

      case "resetApp":
        resetApp();
        break;

      case "saveProfile":
        saveProfile();
        break;

      case "toggle2fa":
        toggle2fa();
        break;

      case "refreshOffers":
        {
          const d = currentData();
          if (!d) {
            toast("Login required.", "warn");
            break;
          }
          ensureOffers(d, true);
          toast("Offerwall refreshed.", "info");
          renderAll();
        }
        break;

      case "completeOffer":
        {
          const id = actionEl.getAttribute("data-offer-id");
          if (id) completeOffer(id);
        }
        break;

      case "openCreateVps":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("createVps");
        break;

      case "openExtendVps":
        openExtendModal();
        break;

      case "createOrResumeVps":
        createOrResumeSelected();
        break;

      case "stopVps":
        stopSelectedWithConfirm();
        break;

      case "destroyVps":
        destroySelectedWithConfirm();
        break;

      case "openVpsConfig":
        // In demo, config uses the same create modal (does not spend unless you submit "Redeem & Create")
        toast("Tip: Use Create VPS to pick plan/region/image (demo).", "info");
        openModal("createVps");
        break;

      case "openSsh":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("ssh");
        break;

      case "copySsh":
        {
          const txt = ui.sshCmd?.textContent || "";
          const ok = await copyToClipboard(txt);
          toast(ok ? "Copied." : "Copy failed.", ok ? "good" : "warn");
        }
        break;

      case "selectInstance":
        // handled in change event
        break;

      case "selectInstanceRow":
        {
          const d = currentData();
          if (!d) break;
          const id = actionEl.getAttribute("data-id");
          if (id) selectInstance(d, id);
        }
        break;

      case "instanceStart": {
        const d = currentData();
        if (!d) {
          toast("Login required.", "warn");
          break;
        }
        const id = actionEl.getAttribute("data-id");
        if (!id) break;
        selectInstance(d, id);
        createOrResumeSelected();
        break;
      }

      case "instanceStop": {
        const d = currentData();
        if (!d) {
          toast("Login required.", "warn");
          break;
        }
        const id = actionEl.getAttribute("data-id");
        if (!id) break;
        selectInstance(d, id);
        stopSelectedWithConfirm();
        break;
      }

      case "instanceDestroy": {
        const d = currentData();
        if (!d) {
          toast("Login required.", "warn");
          break;
        }
        const id = actionEl.getAttribute("data-id");
        if (!id) break;
        selectInstance(d, id);
        destroySelectedWithConfirm();
        break;
      }

      case "recalcCreateCost":
        recalcCreateCost();
        break;

      case "recalcExtendCost":
        recalcExtendCost();
        break;

      case "redeemPromo":
        redeemPromo(ui.promoInput?.value || "");
        if (ui.promoInput) ui.promoInput.value = "";
        break;

      case "redeemPromoModal":
        redeemPromo(ui.promoInputModal?.value || "");
        if (ui.promoInputModal) ui.promoInputModal.value = "";
        break;

      case "openPromo":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("promo");
        break;

      case "openReferral":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("referral");
        break;

      case "copyReferral":
        {
          const d = currentData();
          const code = d?.refCode || "CLOUD-XXXX";
          const link = `https://cloudvps.example/ref/${code}`;
          const ok = await copyToClipboard(link);
          toast(
            ok ? "Copied referral link." : "Copy failed.",
            ok ? "good" : "warn",
          );
        }
        break;

      case "simulateReferral":
        simulateReferral();
        break;

      case "openAchievements":
        if (!currentUserId()) {
          toast("Please sign in first.", "warn");
          openAuthModal("login");
          break;
        }
        openModal("achievements");
        break;

      case "claimAchievement": {
        const d = currentData();
        if (!d) break;
        const id = actionEl.getAttribute("data-id");
        if (id) claimAchievement(d, id);
        break;
      }

      case "claimAllAchievements": {
        const d = currentData();
        if (!d) break;
        claimAllAchievements(d);
        break;
      }

      case "confirmCancel":
        closeModal();
        confirmState.onConfirm = null;
        break;

      case "confirmOk":
        {
          const fn = confirmState.onConfirm;
          confirmState.onConfirm = null;
          closeModal();
          fn?.();
        }
        break;

      case "toggleTheme":
        toggleTheme();
        break;

      case "refreshCharts":
        {
          const d = currentData();
          if (!d) break;
          renderCharts(d);
        }
        break;

      case "simulateDrop": {
        const d = currentData();
        if (!d) {
          toast("Login required.", "warn");
          break;
        }
        addPoints(d, 25, "Bonus drop", "earn", { kind: "system" });
        pushNotif(d, {
          kind: "good",
          title: "Bonus drop +25",
          body: "Limited time reward (demo).",
        });
        toast("+25 bonus", "good");
        persistSoon();
        renderAll();
        break;
      }

      case "simulateSystemNotice": {
        const d = currentData();
        if (!d) {
          toast("Login required.", "warn");
          break;
        }
        pushNotif(d, {
          kind: "info",
          title: "System notice",
          body: "Maintenance scheduled (demo).",
        });
        toast("System notice added.", "info");
        persistSoon();
        renderAll();
        break;
      }

      default:
        break;
    }
  });

  document.addEventListener("change", (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;

    // import JSON (file input)
    if (
      target.matches('[data-action="importData"]') &&
      target instanceof HTMLInputElement
    ) {
      const file = target.files && target.files[0];
      if (file) importData(file);
      target.value = "";
      return;
    }

    // instance select
    if (target.matches('[data-action="selectInstance"]')) {
      const d = currentData();
      if (!d) return;
      const id = target.value;
      if (id) selectInstance(d, id);
      return;
    }

    // settings selects
    if (target === ui.themeSelect) setTheme(ui.themeSelect.value);
    if (target === ui.accentSelect) setAccent(ui.accentSelect.value);
    if (target === ui.densitySelect) setDensity(ui.densitySelect.value);

    // create/extend cost recalcs on select changes
    if (target.closest('[data-ui="createVpsForm"]')) recalcCreateCost();
    if (target.closest('[data-ui="extendForm"]')) recalcExtendCost();
  });

  // forms
  ui.authForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(ui.authForm);
    const mode = String(fd.get("mode") || "login");
    const email = String(fd.get("email") || "");
    const password = String(fd.get("password") || "");
    const name = String(fd.get("name") || "");
    const code = String(fd.get("code") || "");

    if (mode === "register") register({ email, password, name });
    else if (mode === "reset") resetPassword({ email, code, password });
    else login({ email, password });
  });

  ui.createVpsForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    createInstanceFromForm(ui.createVpsForm);
  });

  ui.extendForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(ui.extendForm);
    const hours = Number(fd.get("hours") || 1);
    closeModal();
    extendSelected(hours);
  });

  // live filters / recalcs
  ui.ledgerFilter?.addEventListener("input", () => renderLedger());
  ui.instanceSearch?.addEventListener("input", () => {
    const d = currentData();
    if (d) renderInstanceTable(d);
  });

  ui.createVpsForm?.addEventListener("input", () => recalcCreateCost());
  ui.extendForm?.addEventListener("input", () => recalcExtendCost());

  // settings toggles
  ui.reduceMotionToggle?.addEventListener("change", () =>
    togglePrefBool("reduceMotion"),
  );
  ui.soundToggle?.addEventListener("change", () => togglePrefBool("sound"));
  ui.tipsToggle?.addEventListener("change", () => togglePrefBool("tips"));

  // cmd palette input
  ui.cmdInput?.addEventListener("input", () =>
    renderCmdList(ui.cmdInput.value),
  );
  ui.cmdList?.addEventListener("click", (e) => {
    const t = e.target instanceof HTMLElement ? e.target : null;
    const btn = t?.closest('[data-action="runCmd"]');
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    if (id) runCommand(id);
  });

  // keyboard shortcuts
  let gPrefixAt = 0;
  document.addEventListener("keydown", (e) => {
    // don't interfere while typing
    const ae = document.activeElement;
    const inInput =
      ae &&
      (ae.tagName === "INPUT" ||
        ae.tagName === "TEXTAREA" ||
        ae.isContentEditable);
    if (inInput && !(e.ctrlKey && e.key.toLowerCase() === "k")) return;

    if (e.ctrlKey && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openCommandPalette();
      return;
    }

    if (e.key === "?") {
      e.preventDefault();
      openModal("help");
      return;
    }

    if (e.key.toLowerCase() === "n") {
      if (!activeModal) {
        e.preventDefault();
        if (!currentUserId()) {
          toast("Sign in to see notifications.", "warn");
          openAuthModal("login");
          return;
        }
        openModal("notifications");
      }
      return;
    }

    if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (!activeModal) {
        e.preventDefault();
        toggleTheme();
      }
      return;
    }

    // g then h/e/d/s
    if (e.key.toLowerCase() === "g") {
      gPrefixAt = now();
      return;
    }
    if (gPrefixAt && now() - gPrefixAt < 1200) {
      const k = e.key.toLowerCase();
      if (k === "h") {
        setActiveView("home");
        gPrefixAt = 0;
      }
      if (k === "e") {
        setActiveView("earn");
        gPrefixAt = 0;
      }
      if (k === "d") {
        setActiveView("dashboard");
        gPrefixAt = 0;
      }
      if (k === "s") {
        setActiveView("settings");
        gPrefixAt = 0;
      }
    }
  });

  // ---------------------------------------------------------
  // Misc actions that need direct binding
  // ---------------------------------------------------------
  $$('[data-action="socialLogin"]').forEach((btn) => {
    btn.addEventListener("click", () =>
      socialLogin(btn.getAttribute("data-provider") || "google"),
    );
  });

  // ---------------------------------------------------------
  // Render all
  // ---------------------------------------------------------
  function renderAll() {
    applyPrefs();
    renderHeader();

    const d = currentData();
    if (d) {
      normalizeDaily(d);
      // keep referral inputs up to date
      safeText(ui.refCode, d.refCode);
      safeText(ui.refLink, `https://cloudvps.example/ref/${d.refCode}`);
    } else {
      safeText(ui.refCode, "CLOUD-XXXX");
      safeText(ui.refLink, "https://cloudvps.example/ref/CLOUD-XXXX");
    }

    renderTasksUI();
    renderOffers();
    renderLedger();
    renderDashboard();
    renderSettings();

    // dashboard tab restore (UI only)
    const tab = d?.ui?.dashTab || "overview";
    applyDashTabUI(tab);

    // keep create/extend balances fresh when modal is open
    if (activeModal?.getAttribute("data-modal") === "createVps")
      recalcCreateCost();
    if (activeModal?.getAttribute("data-modal") === "extendVps")
      recalcExtendCost();
  }

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  function init() {
    applyPrefs();

    // initial route
    setActiveView(routeFromHash(), { pushHash: true });

    // onboarding
    if (!app.meta.onboardingDone) {
      app.meta.onboardingDone = true;
      persistSoon();
      toast("Welcome! Use Earn tab to collect points.", "good");
    }

    // ensure user data if logged in
    if (currentUserId()) ensureUserData(currentUserId());

    // sync settings controls initial values
    renderAll();

    // timers
    window.setInterval(() => {
      tickCountdown();
      renderHeader();
      // update time fields without full render
      const d = currentData();
      if (d) {
        const inst = getSelectedInstance(d);
        safeText(
          ui.timePill,
          inst ? formatHHMMSS(inst.timeLeftSec) : "00:00:00",
        );
        safeText(
          ui.timeRemaining,
          inst ? formatHHMMSS(inst.timeLeftSec) : "00:00:00",
        );
      }
      renderTasksUI();
    }, CFG.tickMs);

    window.setInterval(() => {
      tickMetrics();
      const d = currentData();
      if (d) {
        const inst = getSelectedInstance(d);
        if (inst) {
          renderSparkline(inst);
          renderCpuChart(d);
        }
      }
      renderDashboard();
    }, CFG.metricsTickMs);

    // hash routing
    window.addEventListener("hashchange", () =>
      setActiveView(routeFromHash(), { pushHash: false }),
    );

    // expose small debug API
    window.CloudVPS = {
      getApp: () => app,
      resetAll: () => {
        localStorage.removeItem(CFG.storageKey);
        location.reload();
      },
      addPoints: (n = 10) => {
        const d = currentData();
        if (d) {
          addPoints(d, Number(n), "Debug add points", "earn", {
            kind: "debug",
          });
          renderAll();
        }
      },
    };
  }

  init();
})();
