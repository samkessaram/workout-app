# 02: Exercise library

**What to build:** Add and edit Exercises from Settings. An Exercise is its name plus its equipment (machine, dumbbell, cable, barbell, bodyweight), chosen from lists rather than free text where possible. Each Exercise has a smallest weight step (picked from chips on first use), a rep range and a rest category. Defaults per the spec: rep ranges compound 6-10, machine 8-12, isolation 10-15; rest 120s heavy compound, 90s machine/moderate, 60s isolation. Similar Exercises stay distinct (e.g. dumbbell lateral raise vs single-arm cable lateral).

**Blocked by:** 01 App shell and storage

**Status:** ready-for-agent

- [ ] Can create an Exercise with name and equipment, and it persists
- [ ] Smallest weight step is chosen from chips, not typed
- [ ] Rep range and rest category default by exercise kind and are editable
- [ ] Exercises with the same name but different equipment coexist as distinct Exercises
- [ ] Exercise list is viewable and editable in Settings
