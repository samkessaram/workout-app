# Workout

A personal workout logger and progressive-overload coach. The lifter logs sets mid-workout and the app suggests what to lift next.

## Language

**Exercise**:
A named movement identified by its name plus its equipment (machine, dumbbell, cable, barbell, bodyweight). Chosen from a list, never free text.
_Avoid_: Lift, movement, station

**Session**:
One workout on one date, of one Session type, at one Location.
_Avoid_: Workout, visit

**Session type**:
The category of a Session: upper, lower, rowing, or other.
_Avoid_: Split, day

**Location**:
The place a Session happens (gym, new gym, home).
_Avoid_: Venue, gym (as a generic term)

**Set**:
One continuous run of reps of an Exercise at one weight. Either a warmup Set or a working Set; only working Sets drive progression.
_Avoid_: Round, rep group

**Baseline**:
The weight and rep history an Exercise's suggestions are computed from. Shared across Locations by default; split per Location only when the lifter says an Exercise feels different there.
_Avoid_: Starting point, reference

**Correction**:
An explicit fix to a confirmed Set's weight or reps. The previous value stays visible on the Set and is ignored by progression.
_Avoid_: Edit, revision, undo

**Pain flag**:
A mark on an Exercise (and optionally a body area) recording sharp or dull pain and whether to stop or continue. Stays open, and shows in briefs for Exercises sharing that body area, until the lifter resolves it.
_Avoid_: Injury, warning

**Stage**:
Where an Exercise sits in its progression: calibration (first 3 Sessions), novice (add weight nearly every Session), or early-intermediate (add weight only after hitting the top of the rep range on every working Set). Tracked per Exercise, not per lifter.
_Avoid_: Level, phase

**Stall**:
A Session where an Exercise's working Sets missed their target at the same weight. Stalls flagged with a confounder tag (poor sleep, ill, travel, missed food, injury) do not count.
_Avoid_: Plateau, failure

**Suggestion**:
The weight and rep target the app proposes for an Exercise, with a one-line reason. Advice only; the lifter's logged Set is always what counts.
_Avoid_: Prescription, recommendation

**Routine**:
The editable, ordered list of Exercises planned for a Session type, each with target sets, a rep range and a rest category.
_Avoid_: Plan, program, template
