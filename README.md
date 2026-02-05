# CloudVPS — Ultimate Demo (v3)

> Frontend-only demo (no backend). Data is stored in **localStorage**.

## What’s new (big upgrade)
- ✅ **4 main tabs**: Home / Earn / Dashboard / Settings
- ✅ **Multi-instance VPS** (max 3 instances) + **1 running at a time**
- ✅ **Offerwall** (daily UTC refresh), cooldown tasks, streak check-in
- ✅ **Video chain bonus**: watch 3 video ads (within 15 min) => +10 bonus
- ✅ **Achievements** (unlock + claim bonus points)
- ✅ **Notifications inbox** + badge counter
- ✅ **Settings**: theme (light/dark/auto), accent, density, reduce motion, sounds, tips
- ✅ **Command palette** (Ctrl+K) + keyboard shortcuts (G then H/E/D/S, N, T, ?)
- ✅ **Charts**: points (last 7 days) + CPU trend (selected instance)
- ✅ **Export / Import JSON**, Reset app, demo tweaks

## Mobile notes
- Bottom navigation is optimized for mobile (4 tabs, no wrapping).
- Dashboard header + instances list adapt into a stacked layout on small screens.
- Topbar auto-simplifies on mobile to avoid cramped spacing.

## Run
Open `index.html` directly in a browser.

> Recommended: use a local server (better for some browsers)
- VSCode: “Live Server”
- Or: `python -m http.server`

## Notes
- Passwords are stored as a **non-cryptographic hash** (demo only).
- Daily reset is based on **00:00 UTC**.
- VPS metrics & provisioning are simulated.

Enjoy!


## WindowsRDP.yml sync
- Put `WindowsRDP.yml` next to `index.html` (same folder).
- Run via a local server (recommended) so the app can `fetch()` the YML and auto-sync OS/Language options.
  - Example: `python -m http.server` then open `http://localhost:8000`.
- If YML can't be fetched (file://), the UI falls back to embedded defaults matching the provided workflow.
