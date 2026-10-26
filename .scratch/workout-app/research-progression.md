# Adaptive progressive-overload rules for a hypertrophy app

Scope: single lifter, early training age, logged data only (weight, reps, per-set notes, optional RIR), no wearable.

**Labels used throughout:** [E] = supported by peer-reviewed evidence; [P] = practitioner consensus (Helms, Israetel, Nuckols, Schoenfeld writing, RP, SBS); [O] = opinion or my engineering choice (a default to tune, not a finding).

**Verification note.** Sources marked (verified) were returned by web search in this session. Sources marked (from memory) are well-known papers whose URLs or exact numbers I did not re-open. Check the DOI/PubMed ID before quoting. Every numeric default in section 7 is [O] unless stated.

---

## 1. Progression models and where they fit

| Model | How it works | Best fit | Evidence |
|---|---|---|---|
| Linear progression (LP) | Add a fixed load every session or week. Stall means repeat or deload. | Novice, first ~3-9 months. The adaptation rate exceeds recovery so fast that load can rise nearly every exposure, mostly on big compounds. | [P] Starting Strength and GZCLP are program references only. Linear progress is the default novice assumption in Rippetoe/Kilgore and Nuckols' writing. Training status moderates gains: [E] Peterson et al. 2004, Med Sci Sports Exerc, "Influence of resistance exercise volume on strength gains" / Rhea 2003 dose-response (from memory). |
| Double progression (DP) | Fix a rep range (e.g. 8-12). Stay at a load until all sets hit the top of the range, then add load and drop back to the bottom. | Late novice to intermediate, and always for isolation and machine work. Fits hypertrophy because the rep range is itself the target. | [E] Hypertrophy is similar across roughly 5-30 reps if sets are taken near failure (Schoenfeld 2017 low vs high load meta-analysis, J Strength Cond Res; Schoenfeld 2021 review). [E] Progressing by reps or by load gave similar hypertrophy: Plotkin et al. 2022, PeerJ, https://peerj.com/articles/14142 (verified). Nuckols/SBS argue load progression matters more as people advance, https://www.strongerbyscience.com/progressive-overload/ (verified, [P]). |
| RIR/RPE autoregulation | Prescribe a target effort (e.g. 1-3 RIR); the lifter chooses load to hit it. Next-session load is adjusted by how far off the set was. | Intermediate and beyond, and any time linear jumps no longer fit. Needs a lifter able to judge RIR. | [E] RIR-based RPE scale: Zourdos et al. 2016, J Strength Cond Res 30(1):267-275 (from memory). RIR accuracy is good near failure (about 0-3 RIR) and worse far from it (review at https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330, verified as a citing review). [E] Helms et al. 2018 compared RPE and %1RM loading in matched programs (Frontiers in Physiology, https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00247/pdf, verified). |
| Weekly/block periodization | Load, reps, or volume vary by plan across weeks (waves, mesocycle ramps, deloads). | Intermediate and advanced, where progress takes a month or longer per step. | [E] ACSM 2009 position stand recommends progression and periodization as training advances, https://pubmed.ncbi.nlm.nih.gov/19204579/ (from memory). [E] For hypertrophy, periodized and non-periodized programs differ little when volume and effort are matched; periodization matters more for strength (Grgic et al. 2017/2018 meta-analyses, from memory). Israetel's volume-ramp mesocycles are [P] (RP hypertrophy guides). |

**Key conclusions**

1. For hypertrophy, what drives growth is enough weekly volume at hard effort (roughly 0-4 RIR), not the progression model. [E] The weekly-volume dose-response is in Schoenfeld, Ogborn, Krieger 2017, J Sports Sci (published online 2016; https://pubmed.ncbi.nlm.nih.gov/28834797/, a related result in the search; confirm the ID). Proximity to failure meta-analyses (Refalo 2023; Robinson 2024, from memory) support training near failure, with diminishing returns from failure itself.
2. Progression is a means of keeping the stimulus hard as strength rises, so the logic should be "was the set hard and did performance rise," not "did the number go up."
3. Stage fit (approximate; [P]):
   - Months 0-6 of consistent training: LP on compounds, DP on isolations.
   - Months 6-24: DP everywhere, optional RIR logging, volume ramps.
   - 24+ months or repeated stalls: RIR-targeted DP with mesocycle structure and scheduled deloads.
4. Calendar time is a weak proxy. [E] Training-status effects are real but vary widely between people. Use performance behaviour (stall counts) as the primary trigger, with time as a gate.

---

## 2. Detecting stage transitions from logged data

Definitions for code:

- **Exposure**: one session where the lift was done with at least the prescribed working sets.
- **Success**: all working sets reach the target (LP: prescribed reps at prescribed load; DP: at least the bottom of the rep range, with a "top hit" when every set reaches the top).
- **Stall**: an exposure where success fails. Count *consecutive* stalls per lift.
- **Rep-range failure**: first set below the bottom of the range at a load already progressed.
- **e1RM** (for trend only): Epley, `w * (1 + reps/30)`, valid for reps up to about 10. [E] Rep-based 1RM estimation is reasonably accurate at low reps and loses accuracy as reps rise; treat as a trend metric only.

Transition triggers (all [O] defaults, informed by [P] norms such as "novice linear progress ends after about 3 stalls or resets"):

- **Novice (N) to Early-intermediate (E)** per lift, when any holds:
  - 2 consecutive stalls at the same load that were not explained by a note flag (sleep, illness, injury, missed meal), after one automatic reset (below); or
  - 3 resets within 12 weeks; or
  - the lift's median weekly e1RM gain over the last 6 weeks is under 0.5% per week (rolling slope).
  - Gate: at least 8 weeks of logged history on that lift. (Prevents false transitions from noise.)
- **Early-intermediate (E) to Intermediate (I)** per lift, when:
  - 2 full DP cycles (top-hit followed by successful load increase) took more than 4 weeks each, or
  - 3 consecutive stalls at the same load within the rep range, or
  - at least 26 weeks of history on the lift and e1RM slope under 0.25% per week over 8 weeks.
- **Global stage** (for UI, defaults): the stage of the majority of compounds, with isolations always on DP. The stage lives per lift, because a lifter may be intermediate on bench and novice on squat. [P]
- **Demotion**: after a layoff of 3 or more weeks, or a deload with injury notes, drop one stage for that lift for 2-3 sessions and re-ramp with 85-90% of last working load. [P] Detraining is partly regained quickly ("muscle memory"); see ACSM 2009.

What changes at each stage:

| Rule | Novice | Early-intermediate | Intermediate |
|---|---|---|---|
| Progression model | LP on compounds, DP on isolation | DP everywhere | DP with RIR gate and volume/mesocycle plan |
| Increase cadence | Every successful exposure | When all sets at top of range | When all sets at top of range at target RIR |
| Stall response | 1 stall: repeat; 2: reset 10% | 1 stall: repeat; 2: hold + change something small | See section 4 |
| Volume | Fixed 8-12 hard sets/muscle/week | 10-16 | Ramp across mesocycle |
| RIR | Not required | Optional (nudge to log) | Expected on last set |
| Deload | Only reset-driven | Reactive | Scheduled and reactive |

---

## 3. Load increments by lift type

No trial gives universal increments, so these are [P]/[O]. The principle is proportional: an increment should be roughly 1-5% of working load for the lift, and the lift should be able to take it within the rep range.

Typical gym hardware constrains choices: barbell plates 1.25 kg (2.5 lb) per side gives 2.5 kg jumps; fractional plates give 0.5-1.25 kg total; dumbbells jump 1-2.5 kg per hand; machine stacks jump 4.5-7 kg unless a pin-pad adds 1-2 kg.

Defaults (kg; use lb equivalents for 5/2.5/1.25 etc.):

| Category | Novice LP | DP step when top reached | Notes |
|---|---|---|---|
| Lower-body barbell compound (squat, deadlift, RDL) | +5.0 per session or week; +2.5 min | +5.0 (or 2.5-5%) | [P] Starting Strength-style jumps are +2.5 to +5 kg per session for lower body early on. |
| Upper-body barbell compound (bench, OHP, row) | +2.5 | +2.5 (OHP: +1.25 to 2.5) | Upper lifts progress in smaller absolute steps. |
| Dumbbell compound (DB press, row, lunge) | n/a | +1 to +2.5 per hand (smallest available jump) | A DB step is a larger percentage of load; prefer an extra rep first. |
| Machine compound (leg press, chest press, lat pulldown) | n/a | +1 stack step (about 4-7 kg), or +2.5 kg with pin pad if available | Allow "add a rep until step is available". |
| Isolation (curl, lateral raise, triceps extension, leg extension/curl) | n/a | +1 to 2.5 kg, or one stack step; or +2-5% | Most gains come from rep progression. Use microloading. |
| Bodyweight / assisted | n/a | +1 rep, then add 2.5 kg weight | |

Microloading ([P], widely used by Nuckols, RP): fractional plates (0.25-0.5 kg per side) for presses and isolation. Rule in code: if the standard step would be more than 5% of the working load, offer the smallest available step instead, or "add a rep target" (DP handles this naturally).

Rule of thumb for step size selection: `step = max(smallest_increment, round_to_plate(load * pct))` with `pct` by category: lower compound 0.05, upper compound 0.025, machine 0.04, isolation 0.025. Cap novice weekly gains at about 5% of load to avoid ugly jumps. [O]

Equipment profile in the app should store: bar weight, smallest plate, dumbbell step, stack step per exercise. Without that, suggestions will be unloadable.

---

## 4. Deload and stall handling

**Evidence summary**

- [E] The deload literature is thin. Bell et al. 2023, Sports Med Open, review "Integrating deloading into strength and physique sports training programmes" (from memory) found no strong trials. A small trial found no hypertrophy difference with or without a 1-week break (Coleman et al. 2024, from memory). Practitioner norm ([P]): a deload every 4-8 weeks, or when needed based on performance (Israetel, RP; Helms).
- Training breaks of 1-2 weeks do not meaningfully reduce muscle (Ogasawara 2013 and Bosquet 2013 meta-analysis, from memory), so a short deload costs little. [E]
- Reactive deload is simpler and more defensible than scheduled for novices; scheduled becomes more reasonable as volume ramps.

**Stall ladder, per lift** ([O], based on [P] practice):

1. Stall 1 (missed target at the same load): repeat load. Check notes for confounders.
2. Stall 2 consecutive: Novice: reset load by 10% (compounds) or 5% (isolation) and rebuild; Intermediate: keep load, reduce target by 1 rep or add 1 RIR, or add a 2.5 kg microstep only when reps available.
3. Stall 3 consecutive (or rep drop of 2 or more across sets at same load): swap variation (e.g. close-grip, incline, different machine) or drop to bottom of range at -5%.
4. If 3 or more lifts for the same muscle/pattern stall in the same 2 weeks, or any lift shows reps down 15% or more vs. its 4-week best: trigger a **deload week**.

**Deload spec (default)**: 1 week, keep exercises and frequency, cut sets by 40-50% (about half), keep load at 85-90% of working load, stop at 3-4 RIR. [P] Exact numbers vary by author: Israetel uses roughly half the sets; Helms uses reduced volume and intensity.

**Scheduled deload** (Intermediate only): every 6 weeks (range 4-8 per [P]) if none occurred. Skip if a reactive deload or 7-plus-day break occurred in the last 4 weeks.

**Confounder flags** (from notes): illness, poor sleep, injury, travel, missed food. Stalls with a flag do not count toward the ladder. Parsing: simple keyword tags or quick-select chips for notes; free-text keyword matching is brittle. [O]

---

## 5. Working with only logged data

What you can infer, and how reliably:

- **Performance trend**: weight and reps per set. Compute e1RM per set, take the best set per exposure, then a rolling median of 3 exposures to smooth noise. [O]
- **Effort proxy without RIR**: rep drop-off across sets (reps in set 1 vs. last set at constant load). Large drop-off (more than 30-40% across 3 sets) suggests hard effort or rest too short; very low drop-off suggests loads too light. [O]. It is a heuristic only. [E] RIR estimates are reasonably accurate within 0-3 reps of failure (see section 1) but a lifter who stops far from failure will be labelled "successful" without stimulus.
- **Optional RIR**: when logged, treat 0-1 RIR at the top of the range as the signal to add load; treat 4 or more RIR as "load too low, add weight earlier." Do not require it; default to assuming last set about 1-2 RIR when the lifter hit the target with rep-range completion. [O]
- **Volume**: count hard sets per muscle per week from the logged exercise-to-muscle map. [E] Weekly set counts matter more than any session metric; start near 10 sets/muscle/week and ramp with tolerance.
- **Readiness without a wearable**: use cheap signals: session-over-session performance drops (reps down on the first set versus last exposure), a lifter-entered 1-5 tap for energy or soreness (optional), and notes. Subjective readiness measures have reasonable evidence for reflecting training stress (Saw et al. 2016, Br J Sports Med, from memory), but a single tap is noisy. Use only for tie-breaks.
- **Data hygiene**: ignore sets flagged warm-up or "failed/partial," require at least 2 working sets, ignore exposures with unit changes, treat first exposure after a layoff as a re-baseline.
- **Cold start**: first 2-3 exposures per lift are calibration; suggest a conservative weight (RIR guess from the lifter) and no stage logic.

---

## 6. Honest confidence summary

- Strong evidence ([E]): hypertrophy occurs across wide rep ranges near failure; volume has a dose-response up to about 10+ sets; load vs rep progression give similar hypertrophy over short trials; short breaks do not cost muscle.
- Moderate ([E] weak/[P]): RIR accuracy near failure; periodization matters less for hypertrophy than for strength.
- Mostly practitioner ([P]/[O]): all increment sizes, stage thresholds, stall counts, deload frequency, and the specific percentages below. These should be treated as tunable defaults and logged so you can revise them from your own data.

---

## 7. Recommended rule set (state machine)

States are per lift: `CALIBRATION -> NOVICE -> EARLY_INT -> INTERMEDIATE`, with a `DELOAD` overlay and `RE_RAMP` after layoffs.

```ts
const CFG = {
  repRange: { compound: [6, 10], isolation: [10, 15], machine: [8, 12] },
  calibrationExposures: 3,
  novice: {
    maxWeeksBeforeEligibleToLeave: 8,   // gate
    stallsToLeave: 2,                   // consecutive, unflagged, after one reset
    resetsToLeave: 3,                   // within 12 weeks
    slopeFloorPctPerWeek: 0.5,          // 6-week e1RM slope
    resetPct: { compound: 0.10, isolation: 0.05 },
  },
  earlyInt: {
    minWeeks: 26,
    slopeFloorPctPerWeek: 0.25,         // over 8 weeks
    stallsToLeave: 3,
    slowCycleWeeks: 4,                  // two cycles slower than this
  },
  stepPct: { lowerCompound: 0.05, upperCompound: 0.025, machine: 0.04, isolation: 0.025 },
  noviceWeeklyCapPct: 0.05,
  deload: {
    weeks: 1, setFactor: 0.5, loadFactor: 0.9, targetRIR: 3,
    triggerStalledLiftsSameMuscle: 3, withinDays: 14,
    triggerRepDropPct: 0.15,            // vs 4-week best
    scheduledEveryWeeks: 6,             // INTERMEDIATE only
    skipIfDeloadWithinWeeks: 4,
  },
  layoffDemoteDays: 21,
  reRampLoadFactor: 0.875,              // 85-90%
  rirAddLoadAt: 4,                      // RIR >= 4 on last set at top: allow bigger step
};
```

**CALIBRATION** (first 3 exposures per lift)
- Suggest: lifter-chosen load; target the middle of the rep range at about 2-3 RIR. No progression or stall counting.
- Exit: after 3 exposures, go to NOVICE for compounds and EARLY_INT for isolation/machine lifts (they use DP from the start).

**NOVICE** (compounds only; linear)
- Suggest: next load = last load + step if last exposure was a success; else repeat. Step per section 3, capped at 5% per week.
- Success: all prescribed sets and reps completed (default 3 x 8 at load; if the lift's range is 6-10, use top of range for LP rep target).
- Stall ladder: stall 1 repeat; stall 2 reset by `resetPct` and rebuild; resets counted.
- Exit to EARLY_INT: any trigger in section 2 (gate 8 weeks).
- Volume default: 3 working sets per exercise, about 10 sets/muscle/week.

**EARLY_INT** (double progression)
- Suggest: same load; target the range top. When every working set reaches the top of range (a "top hit"), next load = load + step (smallest available that is at most `stepPct` of load), and the rep target resets to the bottom of the range plus 1.
- If sets fall below bottom of range by 2 or more reps: next suggestion -5% load (stall 3 action).
- Optional RIR: if last set RIR is 4 or more at a top hit, use 1.5x step; if RIR is 0 and reps dropped across sets, hold load.
- Stall ladder: stall 2 hold and reduce target by 1 rep or suggest a variation swap; stall 3 variation swap or -5%.
- Exit to INTERMEDIATE: triggers in section 2.

**INTERMEDIATE** (RIR-gated DP, mesocycle aware)
- Suggest: same as EARLY_INT but top hit counts only if last set RIR is 1-3 (when logged; when not logged, assume yes if rep drop-off is under 40%).
- Microload by default (smallest increment; `stepPct` halved) and prefer rep targets.
- Volume: add 1 set per muscle per week across a 4-6 week mesocycle, up to a tolerance ceiling (default 16-20 sets); reset volume after deload.
- Scheduled deload every 6 weeks (see CFG). Reactive deload triggers still active.

**DELOAD overlay** (any stage)
- Enter on trigger (section 4). Suggestion: loads x0.9, sets x0.5, stop at 3 RIR.
- Exit after 1 week, restore prior working loads for the first session back at 100% (loads x1.0 if no layoff; the 0.9 was only for the deload week). Stall counters reset to zero.

**RE_RAMP** (layoff of 21 days or more)
- Entry: gap since last exposure of that lift exceeds `layoffDemoteDays`.
- Suggest: 87.5% of last working load for the first session, then +5% per session until back at old load (max 3 sessions); demote one stage for 3 sessions; no stall counting.

**Global invariants**
- Stall counting ignores sessions with a confounder flag and exposures with fewer than the prescribed sets (partial sessions).
- All suggestions round to equipment increments; if no feasible increment exists, suggest +1 rep instead.
- Log every suggestion and outcome (stage, rule fired, suggested, actual) so thresholds can be tuned against the lifter's own history. [O]

---

## 8. Sources

Verified in this session (search results, not full-text read):
- Plotkin et al. 2022, load vs repetition progression, PeerJ: https://peerj.com/articles/14142
- Stronger By Science, progressive overload: https://www.strongerbyscience.com/progressive-overload/
- Helms et al. 2018, RPE vs %1RM, Frontiers in Physiology: https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2018.00247/pdf
- Citing review on RIR accuracy: https://pmc.ncbi.nlm.nih.gov/articles/PMC5877330
- Schoenfeld, Ogborn, Krieger, weekly volume dose-response, J Sports Sci (2016 online; indexed 2017): https://pubmed.ncbi.nlm.nih.gov/28834797/ (confirm this PMID matches the paper)

From memory (confirm before quoting):
- ACSM Position Stand 2009, "Progression models in resistance training for healthy adults", Med Sci Sports Exerc 41(3):687-708: https://pubmed.ncbi.nlm.nih.gov/19204579/
- Zourdos et al. 2016, RIR-based RPE scale, J Strength Cond Res 30(1):267-275
- Schoenfeld et al. 2017, low- vs high-load meta-analysis, J Strength Cond Res
- Refalo et al. 2023 and Robinson et al. 2024, proximity to failure and hypertrophy
- Bell et al. 2023, deloading review, Sports Med Open; Coleman et al. 2024 deload trial
- Ogasawara et al. 2013, Bosquet et al. 2013, training cessation
- Saw et al. 2016, subjective vs objective monitoring, Br J Sports Med
- Practitioner references: Israetel/RP hypertrophy guides (rpstrength.com), Helms (Muscle and Strength Pyramids), Nuckols/SBS (strongerbyscience.com); Starting Strength and GZCLP as linear-progression program references only.
