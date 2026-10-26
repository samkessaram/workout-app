# 08: Pain flags

**What to build:** One tap on any Exercise raises a Pain flag: sharp or dull, stop or continue, optional body area. The flag stays open until the lifter manually resolves it. Open flags show on the Exercise and, once a Brief exists, in briefs for Exercises sharing that body area. A sharp flag with "stop" marks that movement as stopped for the Session.

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [ ] A Pain flag is created in one tap sequence from an Exercise, with an optional body area
- [ ] Open flags persist across Sessions until manually resolved
- [ ] Open flags are listed and can be resolved from one place
- [ ] Open flags show on other Exercises that share the same body area
- [ ] Brief display of flags is hooked up in ticket 10; this ticket exposes the data for it
