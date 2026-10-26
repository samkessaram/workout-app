Status: needs-triage

# Workout app (Android PWA)

Personal offline-first workout logger and progressive-overload coach, replacing the `workout-coach` Claude skill (`example-skill.md`). Used one-handed, mid-workout, on an Android phone. Vocabulary is in `GLOSSARY.md`; platform decision is in `docs/adr/0001-pwa-with-on-device-storage.md`. Progression research and unverified-citation caveats are in `research-progression.md`.

## Principles

- **No keyboard.** Every input is a tap, swipe or scroll.
- Logging a set takes at most 2 taps when it matches the Suggestion.
- Never silently revise a confirmed number. Fixes are explicit Corrections.
- Suggestions are advice. The logged Set is always what counts. Every Suggestion shows a one-line reason.

## Stack

- Svelte + Vite + TypeScript, `vite-plugin-pwa` (service worker, manifest, offline).
- IndexedDB via Dexie. No backend, no sync.
- Hosted on GitHub Pages (HTTPS needed for install). The repo needs a git remote.
- Vitest for the coaching engine.

## Data

Dexie stores: `exercises` (name, equipment, smallest weight step, rep range, rest category, stage), `routines`, `sessions` (Sets embedded), `painFlags`, `suggestionLog` (stage, rule fired, suggested, actual), `settings`.

- Weights keep the unit they were entered in (lb or kg). The global lb/kg toggle changes display and input only; stored values are never rewritten. Suggestions round to loadable increments in the active unit.
- A Correction keeps the previous value on the Set; progression ignores the superseded value.
- Export: whole DB plus a schema version as JSON, one tap. Nudge after 14 days without export. Call `navigator.storage.persist()`.
- Import: separate mapper for legacy S3 session JSON (user exports it from S3 themselves). Reads legacy variants tolerantly (`weight`, `weight_lbs`, reps as arrays, sets as a number, files outside type folders). A review screen maps unmatched legacy names to Exercises. The real export stays local and gitignored (the repo is public); committed tests use synthetic fixtures.
- Sessions autosave after every confirmed Set and resume after an app kill. A Session left open over 6 hours auto-closes as it stands.

## Screens (bottom tab bar, dark by default, follows system theme, large tap targets)

1. **Today**: start a Session (type, Location, trainer yes/no, timer on/off), or resume one.
2. **Session**: Exercise list, then the set logger.
3. **History**: per-Exercise progress and past Sessions; recall answers come only from stored records.
4. **Routines**: edit the ordered Exercises, target sets, rep range and rest category per Session type. First Routines are seeded from imported history.
5. **Settings**: lb/kg, Exercise list, export/import, backup nudge, custom note chips.

## Session flow

1. **Start**: type, Location, trainer mode, timer on/off.
2. **Brief** (skipped in trainer mode): last 1-2 Sessions of this type, today's Suggestions, relevant open Pain flags.
3. **Logging**: weight chips from history for that Exercise (last weight recommended, one step down, one step up) plus a horizontal scroll strip moving in the Exercise's smallest jump, with +/- buttons. Reps use the same pattern, centred on the target range. Warmup toggle on a Set (skips timer, ignored by progression; no warmup suggestions in v1). After each Exercise: buttons for the remaining Routine Exercises plus Done.
4. **Notes**: tappable chips on a Set or Exercise (tight hips, shaky, form broke down, left/right side failed first, felt easy, felt heavy). Confounder chips: poor sleep, ill, travel, missed food, injury. User can add custom chips; optional free text exists but is never required.
5. **Close**: summary and next-session targets stored on the Session. If Exercises were skipped or added, ask once whether to update the Routine.
6. **Pain flag**: one tap on any Exercise: sharp/dull, stop/continue, optional body area. Stays open and shows in briefs for Exercises sharing that area until manually resolved.

## Rest timer

- Starts after a working Set. Defaults: 120s heavy compounds, 90s machine/moderate, 60s isolation. Skipped for warmups, the last Set of the last Exercise, and when timer is off or in trainer mode.
- Runs from an end timestamp. Screen wake lock while a Session is open. Vibrates and beeps at zero while the app is open.
- No alert when the phone is locked (PWA limit, see ADR 0001). On return it shows actual rest elapsed.

## Coaching engine (pure TypeScript, built test-first)

Stages are per Exercise: `CALIBRATION` (first 3 Sessions, no stage logic) then `NOVICE` for compounds (add weight nearly every Session when targets are met) or `EARLY_INT` double progression for isolation and machine Exercises. The lifter is currently a novice. Compounds move NOVICE to EARLY_INT on stalls or flat e1RM slope per `research-progression.md` section 2 (8-week history gate).

- Double progression: hold the weight until every working Set hits the top of the rep range, then add one increment and restart at the bottom of the range.
- Defaults (editable per Exercise): rep ranges compound 6-10, machine 8-12, isolation 10-15. Step as percent of load: lower compound 5%, upper compound 2.5%, machine 4%, isolation 2.5%, rounded to the stored smallest step. If no feasible step exists, suggest +1 rep. First use of an Exercise asks for its smallest weight jump from chips.
- Stall ladder: 1 stall repeat; 2 consecutive reset 10% (compound) or 5% (isolation) on NOVICE, hold and reduce target on EARLY_INT; 3 consecutive or a rep drop of 2+ reps across Sets: swap variation or drop 5%. Stalls with a confounder chip do not count.
- Reactive deload suggestion (never forced): 3 stalled Exercises for the same muscle within 14 days, or reps down 15% or more vs the 4-week best. Default: 1 week, half the sets, 90% load.
- Post-layoff re-ramp: gap of 21+ days on an Exercise starts at 87.5% of the last working weight and steps back up over up to 3 Sessions, with no stall counting.
- Baseline: history is shared across Locations. If the first Set at a Location deviates 15% or more from the Suggestion, ask once: "Same as before / Feels different (new baseline here)".
- Missing history: say so and suggest a conservative start. Never invent a number.
- Trainer mode: pure logging, no coaching, no timer unless asked.
- Thresholds are the research doc's tunable defaults, not findings; `suggestionLog` exists so they can be tuned from real history.
- Testing: replay the S3 history through the engine to sanity-check Suggestions; UI is tested manually on the phone.

## Deferred (post-v1)

RIR input row, the INTERMEDIATE stage (RIR-gated progression), volume ramps, scheduled deloads, charts and e1RM graphs, PR detection, plate calculator, body-weight log, optional Claude-API brief layer, optional sync, native shell for lock-screen timer alerts.

## Open items

- Confirm the Schoenfeld PMID and other unverified citations if any are ever quoted.
