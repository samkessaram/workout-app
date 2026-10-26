# 08: Pain flags

**What to build:** One tap on any Exercise raises a Pain flag: sharp or dull, stop or continue, optional body area. The flag stays open until the lifter manually resolves it. Open flags show on the Exercise and, once a Brief exists, in briefs for Exercises sharing that body area. A sharp flag with "stop" marks that movement as stopped for the Session.

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [x] A Pain flag is created in one tap sequence from an Exercise, with an optional body area
- [x] Open flags persist across Sessions until manually resolved
- [x] Open flags are listed and can be resolved from one place
- [x] Open flags show on other Exercises that share the same body area
- [x] Brief display of flags is hooked up in ticket 10; this ticket exposes the data for it
