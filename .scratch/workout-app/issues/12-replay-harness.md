# 12: Replay harness

**What to build:** A script or test that replays the imported S3 history through the coaching engine, Session by Session, and prints the Suggestion for each Exercise next to what the lifter actually lifted. This lets the lifter sanity-check the engine against real history before trusting it.

**Blocked by:** 10 Coaching engine v1, 11 Legacy S3 import

**Status:** ready-for-agent

- [x] Running one command replays the fixture history through the engine
- [x] Output shows, per Exercise per Session: suggested vs actual, and the rule fired
- [x] Output flags large disagreements for review
- [x] The harness reuses the engine as-is, with no separate copy of the rules
