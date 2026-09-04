# Both Sides — project wiki

Current-state documentation for the scrollytelling project ("קיצוניים משני הצדדים").
Everything here describes the **v2 branch as it is now** — no history narration; use
`git log` for how things got here.

> **Keep this wiki updated.** Any change that alters behavior, structure, naming,
> constants' meaning, or the fold lineup must update the matching page in the same
> work session. If a page and the code disagree, the code wins — fix the page.

## Pages

| Page | Covers |
|---|---|
| [Architecture](Architecture.md) | The two entry points, file roster, script loading & shared globals, dev server |
| [Folds](Folds.md) | The canonical `@foldN` table and what plays on each fold |
| [Animation-System](Animation-System.md) | Easing curves, trigger architecture, duration tiers, beats, stagger, project-wide rules |
| [Groups-and-Legend](Groups-and-Legend.md) | `GROUPS` roster, camp columns, the persistent mini-legend, camp headers |
| [Timeline](Timeline.md) | The pinned real timeline (`page7.js`): square cascade + canvas year axis |
| [Drag-and-Drop](Drag-and-Drop.md) | Page-9 categorization panel, drop animation states |
| [Data](Data.md) | `events.json`, the xlsx source, category/actor mappings |
| [Dev-Workflow](Dev-Workflow.md) | Running the project, harness (`manual/`/`compare/`) convention, verification habits |
| [Glossary](Glossary.md) | Shared shorthand terms (@legend, @dragcards, axis events, state 1/2…) |

## Quick facts

- Vanilla JS, classic `<script>` tags, **no build step / npm / tests**.
- Serve with `python3 server.py` → http://localhost:8080 (auto-reload; never kill it as cleanup).
- Design source of truth: Figma file `QASHSt1u7b6m6ASgrUPswf` ("Design"); pages are revised
  one at a time to pixel parity — only explicitly revised pages match Figma.
- Fold numbering: **always** resolve `@foldN` via [Folds](Folds.md) — it is off by one from
  the HTML ids (`@foldN` = `id="page-(N-1)"`).

- [Teacher-Review-2026-09-03](Teacher-Review-2026-09-03.md) — action items from the 3 Sep 2026 review call; tick off as they land
