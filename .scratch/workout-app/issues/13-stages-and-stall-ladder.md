# 13: Stages and stall ladder

**What to build:** Per-Exercise Stages beyond calibration: NOVICE for compounds (add weight nearly every Session when targets are met) and EARLY_INT double progression for isolation and machine Exercises. Compounds move from NOVICE to EARLY_INT on stalls or a flat e1RM slope per `research-progression.md` section 2, behind the 8-week history gate. The stall ladder: 1 Stall repeats; 2 consecutive resets 10% (compound) or 5% (isolation) on NOVICE, or holds and reduces target on EARLY_INT; 3 consecutive, or a rep drop of 2+ reps across Sets, suggests swapping the variation or dropping 5%. Stalls carrying a confounder chip do not count. Thresholds are tunable defaults, not findings.

**Blocked by:** 07 Notes and confounder chips, 12 Replay harness

**Status:** ready-for-agent

- [ ] Stage is tracked per Exercise and shown with each Suggestion's reason
- [ ] NOVICE compounds are suggested a weight increase nearly every Session when targets are met
- [ ] The NOVICE to EARLY_INT transition follows the research doc and the 8-week gate
- [ ] Each rung of the stall ladder is covered by tests
- [ ] A Stall with a confounder chip does not advance the ladder
- [ ] Replay harness output reflects the new stages on real history
