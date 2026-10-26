# 06: Corrections

**What to build:** The lifter can make an explicit Correction to a confirmed Set's weight or reps. The previous value stays visible on the Set, and progression ignores the superseded value. Confirmed numbers are never silently revised.

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [ ] A confirmed Set can be corrected via an explicit action using the same chip/strip input
- [ ] The previous value remains stored and visible on the Set
- [ ] History and chips derived from history use the corrected value, not the superseded one
- [ ] No other path changes a confirmed Set's numbers
