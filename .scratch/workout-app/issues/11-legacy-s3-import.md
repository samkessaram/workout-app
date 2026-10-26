# 11: Legacy S3 import

**What to build:** A separate mapper that imports the lifter's legacy S3 session JSON (exported by the lifter themselves) into Sessions. It reads the legacy variants tolerantly: `weight`, `weight_lbs`, reps as arrays, sets as a number, and files outside the type folders. A review screen maps unmatched legacy exercise names to Exercises (or creates them) using taps. The first Routines are seeded from the imported history. The real export is kept locally (gitignored) for the replay harness; committed tests use synthetic fixtures.

**Blocked by:** 02 Exercise library, 03 Log a Session (basic)

**Status:** ready-for-agent

- [x] Importing a legacy export creates Sessions with Sets in the app's format and original units
- [x] Each legacy variant listed above is handled, with tests using synthetic fixtures
- [x] Unmatched names go through a tap-only review screen to map or create Exercises
- [x] Re-importing the same export does not duplicate Sessions
- [x] Initial Routines are seeded from the imported history and are editable
- [x] Records that cannot be parsed are reported, not silently dropped
- [x] The real export stays out of the public repo (gitignored under `fixtures/private/`); committed tests use small synthetic fixtures that cover each legacy variant
