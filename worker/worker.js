// Cloudflare Worker — GitHub Actions proxy + webhook store (KV)
// Endpoints:
//  GET  /api/health
//  GET  /api/config                  (reads workflow yml from GitHub, extracts input options)
//  POST /api/dispatch                (dispatch workflow_dispatch, returns dispatch_id + maybe run_id)
//  GET  /api/dispatch/:id/resolve    (resolve run_id for dispatch_id)
//  GET  /api/runs/:runId             (run status)
//  POST /api/runs/:runId/cancel      (cancel run)
//  POST /api/webhook/connection      (called by GitHub Actions to store connection info) -> KV key conn:<runId>
//  GET  /api/runs/:runId/connection  (reads KV connection info)
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return cors(new Response(null, { status: 204 }), request);
    }

    try {
      const { pathname } = url;

      if (pathname === "/api/health") {
        return cors(json({ status: "ok" }), request);
      }

      if (pathname === "/api/config" && request.method === "GET") {
        const yml = await fetchWorkflowYml(env);
        const parsed = parseWorkflowYml(yml);
        return cors(json(parsed), request);
      }

      if (pathname === "/api/dispatch" && request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        const os_version = String(body.os_version || "").trim();
        const language = String(body.language || "").trim();
        if (!os_version || !language) return cors(json({ error: "Missing inputs" }, 400), request);

        const dispatch_id = crypto.randomUUID();
        const dispatched_at = new Date().toISOString();

        await ghDispatch(env, {
          ref: env.GITHUB_REF || "main",
          inputs: { os_version, language }
        });

        // Try to resolve run id quickly (best-effort)
        const run = await tryResolveRun(env, dispatched_at);
        if (run?.id) {
          await env.SESSIONS_KV?.put(`dispatch:${dispatch_id}`, JSON.stringify({
            run_id: run.id,
            html_url: run.html_url,
            created_at: run.created_at,
            dispatched_at
          }), { expirationTtl: 60 * 60 });
        } else {
          await env.SESSIONS_KV?.put(`dispatch:${dispatch_id}`, JSON.stringify({
            run_id: null,
            html_url: null,
            created_at: null,
            dispatched_at
          }), { expirationTtl: 60 * 60 });
        }

        return cors(json({
          dispatch_id,
          dispatched_at,
          run_id: run?.id || null,
          html_url: run?.html_url || null
        }), request);
      }

      const mResolve = pathname.match(/^\/api\/dispatch\/([^/]+)\/resolve$/);
      if (mResolve && request.method === "GET") {
        const id = decodeURIComponent(mResolve[1]);
        const raw = await env.SESSIONS_KV?.get(`dispatch:${id}`);
        if (!raw) return cors(json({ run_id: null }), request);

        const data = JSON.parse(raw);
        if (data.run_id) return cors(json({ run_id: data.run_id, html_url: data.html_url || null }), request);

        // try resolve again using stored timestamp
        const run = await tryResolveRun(env, data.dispatched_at);
        if (run?.id) {
          await env.SESSIONS_KV?.put(`dispatch:${id}`, JSON.stringify({
            ...data,
            run_id: run.id,
            html_url: run.html_url,
            created_at: run.created_at
          }), { expirationTtl: 60 * 60 });
          return cors(json({ run_id: run.id, html_url: run.html_url || null }), request);
        }
        return cors(json({ run_id: null }), request);
      }

      const mRun = pathname.match(/^\/api\/runs\/(\d+)$/);
      if (mRun && request.method === "GET") {
        const runId = mRun[1];
        const run = await ghGet(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}`);
        return cors(json(run), request);
      }

      const mCancel = pathname.match(/^\/api\/runs\/(\d+)\/cancel$/);
      if (mCancel && request.method === "POST") {
        const runId = mCancel[1];
        await ghPost(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/runs/${runId}/cancel`, {});
        return cors(json({ ok: true }), request);
      }

      const mConn = pathname.match(/^\/api\/runs\/(\d+)\/connection$/);
      if (mConn && request.method === "GET") {
        const runId = mConn[1];
        const raw = await env.SESSIONS_KV?.get(`conn:${runId}`);
        if (!raw) return cors(json({}), request);
        return cors(new Response(raw, { headers: { "Content-Type": "application/json" } }), request);
      }

      if (pathname === "/api/webhook/connection" && request.method === "POST") {
        const auth = request.headers.get("Authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!env.WEBHOOK_SECRET || token !== env.WEBHOOK_SECRET) {
          return cors(json({ error: "Unauthorized" }, 401), request);
        }
        const body = await request.json().catch(() => ({}));
        const run_id = String(body.run_id || "").trim();
        if (!run_id) return cors(json({ error: "Missing run_id" }, 400), request);

        // normalize and store
        const conn = {
          run_id,
          rdp: body.rdp || body.rdp_public_ip || "",
          web: body.web || body.web_public_ip || "",
          username: body.username || "Admin",
          password: body.password || "Window@123456",
          os_name: body.os_name || "",
          ts: Date.now()
        };

        await env.SESSIONS_KV?.put(`conn:${run_id}`, JSON.stringify(conn), { expirationTtl: 8 * 60 * 60 });
        return cors(json({ ok: true }), request);
      }

      return cors(json({ error: "Not found" }, 404), request);
    } catch (err) {
      return cors(json({ error: String(err?.message || err) }, 500), request);
    }
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function cors(res, req) {
  const h = new Headers(res.headers);
  const origin = req.headers.get("Origin") || "*";
  // No credentials here, safe to use *
  h.set("Access-Control-Allow-Origin", origin === "null" ? "*" : origin);
  h.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  h.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  h.set("Access-Control-Max-Age", "86400");
  return new Response(res.body, { status: res.status, headers: h });
}

async function fetchWorkflowYml(env) {
  // Fetch workflow file content from GitHub Contents API
  const path = encodeURIComponent(env.WORKFLOW_PATH || ".github/workflows/WindowsRDP.yml");
  const ref = encodeURIComponent(env.GITHUB_REF || "main");
  const data = await ghGet(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${ref}`);
  if (!data?.content) throw new Error("Workflow file not found or missing content");
  const b64 = data.content.replace(/\n/g, "");
  const text = atob(b64);
  return text;
}

function parseWorkflowYml(txt) {
  // targeted parser: extract inputs os_version + language (options + default) and timeout-minutes
  const lines = txt.split(/\r?\n/);

  function findBlock(name) {
    let start = -1;
    let indent = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\s*)([A-Za-z0-9_]+):\s*$/);
      if (m && m[2] === name) { start = i; indent = m[1].length; break; }
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
  }

  function stripQuotes(s) {
    return String(s).replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }

  function parseInput(inputName) {
    const block = findBlock(inputName);
    let def = "";
    const opts = [];
    let inOpts = false;
    let optIndent = 0;

    for (const ln of block) {
      const mDef = ln.match(/^\s*default:\s*(.+)\s*$/);
      if (mDef) def = stripQuotes(mDef[1].trim());

      const mOpt = ln.match(/^(\s*)options:\s*$/);
      if (mOpt) { inOpts = true; optIndent = mOpt[1].length; continue; }

      if (inOpts) {
        const leading = (ln.match(/^(\s*)/) || ["", ""])[1].length;
        if (leading <= optIndent) { inOpts = false; continue; }
        const mItem = ln.trim().match(/^- (.+)$/);
        if (mItem) opts.push(stripQuotes(mItem[1].trim()));
      }
    }
    return { def, opts };
  }

  const os = parseInput("os_version");
  const lang = parseInput("language");

  const tm = txt.match(/timeout-minutes:\s*(\d+)/);
  const timeoutMinutes = tm ? Number(tm[1]) : 360;

  return {
    osOptions: os.opts,
    osDefault: os.def,
    languageOptions: lang.opts,
    languageDefault: lang.def,
    timeoutMinutes
  };
}

async function ghDispatch(env, payload) {
  await ghPost(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${encodeURIComponent(env.WORKFLOW_FILE || "WindowsRDP.yml")}/dispatches`, payload);
}

async function tryResolveRun(env, dispatchedAtIso) {
  // Best effort: fetch latest workflow_dispatch runs and find the earliest one created after dispatchedAt
  const list = await ghGet(env, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${encodeURIComponent(env.WORKFLOW_FILE || "WindowsRDP.yml")}/runs?event=workflow_dispatch&per_page=10`);
  const runs = list?.workflow_runs || [];
  const t0 = Date.parse(dispatchedAtIso) - 10_000; // -10s tolerance
  for (const r of runs) {
    const created = Date.parse(r.created_at || "");
    if (Number.isFinite(created) && created >= t0) return r;
  }
  return null;
}

async function ghGet(env, path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "cloudvps-worker"
    }
  });
  if (!res.ok) throw new Error(`GitHub GET ${res.status}: ${await res.text()}`);
  return res.json();
}

async function ghPost(env, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github+json",
      "User-Agent": "cloudvps-worker",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body || {})
  });
  // dispatch endpoint returns 204 no content
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`GitHub POST ${res.status}: ${await res.text()}`);
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}
