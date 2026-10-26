# 05: Rest timer

**What to build:** After a confirmed working Set, a rest countdown starts using the Exercise's rest category (120s heavy compound, 90s machine/moderate, 60s isolation), with 60/90/120 presets. It is skipped for warmup Sets, the last Set of the last Exercise, when the Session's timer is off, and in trainer mode (unless asked). It runs from an end timestamp so it stays correct if the app is backgrounded, holds a screen wake lock while a Session is open, and vibrates and beeps at zero while the app is open. It cannot alert on a locked phone (see ADR 0001); on return it shows the actual rest elapsed.

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [x] Timer starts automatically after a working Set with the right default duration
- [x] Timer is skipped in each of the specified cases
- [x] Countdown stays accurate after the app is backgrounded and resumed
- [x] Wake lock is held while a Session is open
- [x] Vibrate and beep fire at zero when the app is open
- [x] On return after a long gap, the actual rest elapsed is shown
