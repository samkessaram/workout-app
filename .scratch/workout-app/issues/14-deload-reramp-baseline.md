# 14: Deload, re-ramp and per-Location Baseline

**What to build:** Three adjustments to Suggestions. (1) Reactive deload suggestion, never forced: 3 stalled Exercises for the same muscle within 14 days, or reps down 15% or more versus the 4-week best; default is 1 week at half the sets and 90% load. (2) Post-layoff re-ramp: a gap of 21+ days on an Exercise starts at 87.5% of the last working weight and steps back up over up to 3 Sessions, with no Stall counting. (3) Baseline: history is shared across Locations; if the first Set at a Location deviates 15% or more from the Suggestion, ask once with "Same as before / Feels different (new baseline here)", and split that Exercise's Baseline for the Location only if the lifter says it feels different.

**Blocked by:** 13 Stages and stall ladder

**Status:** ready-for-agent

- [x] Deload suggestion appears under each trigger and can be dismissed or accepted
- [x] Re-ramp starts at 87.5% after a 21+ day gap and returns to normal within 3 Sessions
- [x] No Stall is counted during a re-ramp
- [x] The Location deviation prompt appears once and its answer is respected afterwards
- [x] All three behaviours have unit tests and show a one-line reason
