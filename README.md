# CloudVPS (Vanilla) — Firebase RTDB + Cloudflare Worker + GitHub Actions

This project turns your frontend into a *real control panel*:
- **Firebase Auth + Realtime Database**: store users + sessions
- **Cloudflare Worker**: keeps GitHub token secret, dispatch/cancel runs, and stores **connection info** posted from workflow
- **WindowsRDP workflow**: posts connection info back to Worker via webhook

## 1) Deploy frontend (Cloudflare Pages)
Upload **public/** to Cloudflare Pages.
- build command: (none)
- output dir: `public`

## 2) Firebase setup (Realtime Database)
1. Firebase Console → Authentication:
   - Enable Email/Password
   - Enable Google + GitHub (optional)

2. Firebase Console → Realtime Database:
   - Create DB
   - Paste rules from below

3. Put your config into `public/firebase-config.js`:
```js
window.FIREBASE_CONFIG = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "...",
  appId: "..."
};
```

### RTDB rules (minimal)
```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "vps": {
      "$uid": {
        "$id": {
          ".read": "auth != null && auth.uid === $uid",
          ".write": "auth != null && auth.uid === $uid"
        }
      }
    }
  }
}
```

## 3) Cloudflare Worker setup
Deploy `worker/worker.js`.

### Bindings (required)
- **Secrets**:
  - `GITHUB_TOKEN` (repo access to dispatch/cancel)
  - `GITHUB_OWNER` (e.g. your-username)
  - `GITHUB_REPO`  (e.g. your-repo)
  - `GITHUB_REF`   (e.g. main)
  - `WORKFLOW_FILE` (e.g. WindowsRDP.yml)
  - `WORKFLOW_PATH` (e.g. .github/workflows/WindowsRDP.yml)
  - `WEBHOOK_SECRET` (random string)

- **KV Namespace**:
  - bind name: `SESSIONS_KV`

### Worker URLs
Your frontend Settings → **Worker API Base URL**:
- If Worker is on `https://xxx.workers.dev`, paste that.
- If you route Worker under same domain (Pages Functions/Routes), leave empty.

## 4) Patch your GitHub Actions workflow
Use `workflow/WindowsRDP.patched.yml` as your `.github/workflows/WindowsRDP.yml`.

Set these GitHub repo secrets:
- `WEBHOOK_URL` = your worker base url (e.g. https://xxx.workers.dev)
- `WEBHOOK_SECRET` = same as Worker secret

Now when the workflow captures RDP/Web addresses, it will POST them to:
`/api/webhook/connection`
and the FE can fetch them via:
`/api/runs/<runId>/connection`

## Notes
- This is still frontend-heavy. For anti-cheat points, move awarding to Worker later.
- Current workflow hardcodes password (as in your yml). Consider randomizing per run later.
