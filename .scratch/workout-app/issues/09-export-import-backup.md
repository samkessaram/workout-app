# 09: Export, import and backup nudge

**What to build:** One-tap export of the whole database plus a schema version as a JSON file, and a matching restore from such a file. The app calls `navigator.storage.persist()` and nudges the lifter after 14 days without an export, since backup is manual (ADR 0001).

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [ ] Export produces one JSON file containing all stores and a schema version, in one tap
- [ ] Importing that file into a fresh install restores all data
- [ ] An import with an unknown or newer schema version is refused with a clear message
- [ ] `navigator.storage.persist()` is requested
- [ ] A nudge appears after 14 days since the last export and clears after exporting
