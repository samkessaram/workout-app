# 01: App shell and storage

**What to build:** An installable, offline-capable Android PWA shell. Opening the app shows a bottom tab bar (Today, History, Routines, Settings) with large tap targets, dark by default and following the system theme. The Dexie database exists with the stores from the spec (exercises, routines, sessions, painFlags, suggestionLog, settings). Settings has the global lb/kg toggle, which changes display and input only and never rewrites stored values. Vitest is wired up.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The app can be installed to an Android home screen and opens with no network
- [x] Four tabs navigate between placeholder screens
- [ ] Theme is dark by default and follows the system theme
- [x] Dexie schema is versioned and the stores from the spec exist
- [x] lb/kg setting persists across reloads
- [x] `vitest` runs a passing smoke test
