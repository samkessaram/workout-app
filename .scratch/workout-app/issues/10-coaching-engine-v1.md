# 10: Coaching engine v1: double progression and Brief

**What to build:** A pure TypeScript coaching engine, built test-first, that turns an Exercise's history into a Suggestion with a one-line reason. v1 covers CALIBRATION (first 3 Sessions, no stage logic) and double progression: hold the weight until every working Set hits the top of the rep range, then add one increment and restart at the bottom. Step is a percent of load (lower compound 5%, upper compound 2.5%, machine 4%, isolation 2.5%) rounded to the Exercise's smallest step; if no feasible step exists, suggest +1 rep. Warmup Sets and superseded (Corrected) values are ignored. With no history, say so and suggest a conservative start rather than inventing a number. Suggestions appear in the Session Brief (last 1-2 Sessions of this type, today's Suggestions, relevant open Pain flags) and as the recommended chips in the logger, and each is written to `suggestionLog` along with what was actually logged. Trainer mode is pure logging: no Brief, no Suggestions, no coaching.

**Blocked by:** 03 Log a Session (basic)

**Status:** ready-for-agent

- [x] Engine is pure TS with unit tests written first, covering double progression, rounding, +1 rep fallback, calibration and missing history
- [x] Each Suggestion carries a one-line reason shown to the lifter
- [x] Suggestions respect the active unit and round to loadable increments
- [x] The Brief shows the last 1-2 Sessions of the type, Suggestions and relevant open Pain flags
- [x] Logger chips mark the Suggestion as recommended
- [x] `suggestionLog` records stage, rule fired, suggested and actual values
- [x] Trainer mode shows no Brief, Suggestions or coaching
- [x] Warmups and Corrected-away values never influence a Suggestion
