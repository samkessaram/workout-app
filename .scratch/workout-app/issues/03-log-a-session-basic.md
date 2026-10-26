# 03: Log a Session (basic)

**What to build:** The core tracer bullet. From Today, start a Session by choosing Session type, Location, trainer yes/no and timer on/off. Pick Exercises, then log Sets: weight chips built from that Exercise's history (last working weight recommended, one step down, one step up) plus a horizontal scroll strip moving in the Exercise's smallest step with +/- buttons; reps use the same pattern centred on the target range. A Set can be toggled as warmup. Logging a Set that matches the chips takes at most 2 taps. The Session autosaves after every confirmed Set and resumes after an app kill; one left open over 6 hours auto-closes as it stands. Close shows a plain summary of what was logged. No Suggestions yet. With no history for an Exercise, say so and let the lifter pick freely.

**Blocked by:** 02 Exercise library

**Status:** ready-for-agent

- [x] A Session can be started, Sets logged for several Exercises, and closed with a summary
- [x] Weight chips come from that Exercise's history; the last weight is marked recommended
- [x] Scroll strip and +/- move in the Exercise's smallest step; no keyboard is needed anywhere
- [x] A matching Set is logged in at most 2 taps
- [x] Warmup Sets are flagged and stored distinctly from working Sets
- [x] Killing the app mid-Session and reopening resumes it with all confirmed Sets
- [x] A Session open for over 6 hours auto-closes as it stands
- [x] Weights keep the unit they were entered in
