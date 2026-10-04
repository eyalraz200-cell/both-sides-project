# Data to-do (pinned 2026-10-03)

The running list of data work agreed with the user. Strike items as they land and note the
date; the rules behind each one live in [Data](Data.md).

## In flight
- [x] Second split pass (70 rows → 84 children): classified, translated, crowds corrected, shipped (2026-10-03).

## Tail cut (temporary)
- [ ] `server.py` drops every row dated after ACLED's last day (`last_acled`, 2026-07-03 today) —
      633 Fortress rows are off the site **for now only**. Every pipeline step (actor, split,
      type, Hebrew, English, Arabic, crowd) still runs over them so they are ready the day the
      cut is lifted. Lifting it = removing the `last_acled` check, not re-processing.

## Completeness
- [x] **Every shipped event must carry actor, date, Hebrew description, event type and a crowd
      field** — crowd may be "unknown", but the field exists and is deliberate, never an
      accident of a missing column. Today: actor/date/type/desc complete; crowd known on
      ~3,000 of ~12,400.
- [x] Crowd for the rest — `05_extract_crowd.py`, 2026-10-03: 4,697 rows sent, 817 new figures (479 ACLED, 338 Fortress), 3,880 `no report`, 9,439 cue-less ACLED blanks marked `no report` by rule. Every live row now has a deliberate crowd value.
- [x] **Fortress Hebrew** is the log's terse line ("בתים הותקפו"). Rewrite every Fortress row in
      the ACLED-derived Hebrew register: past tense, the actor named explicitly ("מתנחלים תקפו
      בתים ב…"), place kept, same length as the ACLED Hebrew rows.
      → `06_rewrite_fortress_desc.py`, queued 2026-10-03 behind the crowd run (2,352 rows); writes
      the English line in the same call. Then: sample review, restart, commit.
- [x] **English is far too long** — step 07 done 2026-10-04: every shipping row has `description_en_short` (median 1.35× its Hebrew, max 380 chars). Shorten every English description to the
      Hebrew length — same facts as the Hebrew, nothing more.
- [x] **Fortress → English**: the English page shows Hebrew tooltips for Fortress rows — covered by step 06 above.
- [x] **Arabic for every event** — `description_ar` on every shipping row (step 07, 2026-10-04); server writes `events-ar.json`, page7 loads it on ar/.
- [x] Hebrew terminology pass (2026-10-03, user's calls): משתמטים/השתמטות → עריקים/עריקות everywhere; ASCII `"` → ״; המהפכה המשפטית → הרפורמה המשפטית (both translated ACLED's "overhaul"); כיכר אל־קודס (Tamra) kept — a place name. ערבים־ישראלים → ערבים ישראלים.

## Classification
- [x] Commit `events.json` / `events-en.json` + today's scripts, server and wiki (site is stale).
- [x] Prompt check before the rerun (2026-10-04): 190 stratified ACLED rows run live; user ruled on block+clash, police clashes, counter-protesters, abduction vs in-place detention, road paving — all in the 02 prompt.
- [x] Dot flagging round 1 (2026-10-04): pogrom crowd threshold raised to 30+ (a stated 15/20 or no size is not a crowd); 5 live pogroms reclassified by hand (rows 8668, 9523, 11015, 13442, 18628). 20 pogroms remain.
- [ ] **Last step, after everything else:** rerun step 02 over the original ACLED rows with the
      new prompt, hand-set rows skipped — the 63 hand fixes covered only what the review surfaced.
- [x] The 342 `unsure` Fortress↔ACLED pairs — second reading 2026-10-03 (`_dedupe/pass2/`): 298 sure (hidden `dup of row-N`), 44 distinct (stay live); the last 11 decided by the user.
- [x] Internal Fortress duplicates (2026-10-04, `_dedupe/fint/`): live Fortress rows grouped by place ±1 day (273 groups), read by 6 readers — 63 duplicate sets, 87 rows hidden as `fortress dup of row-N` (most detailed row kept).
- [x] Flagged Fortress rows (2026-10-03): 55 settled by the existing rules, 15 by the user. User rule: an act done by soldiers, a regional-defence (גמ״ר) soldier or a settlement guard — even with settlers along or at their request — is `not relevant` (army act, off the site); a רבש״ץ who shoots stays `settlers`. Refined the same day: settlers WITH soldiers, settlers-then-soldiers, and a guard alone stay `settlers`; "soldiers known as settlers" are `not relevant` (10 rows).

## Methodology copy (its own task)
- [ ] The @fold6 card («תיאורי האירועים … לקוחים ברובם ממאגר ACLED…»), the legend note
      (`FOLD6_NOTE_TEXT`, js/groups.js) and the @fold16 credits still describe an ACLED-only
      dataset. Rewrite to name the Fortress log as the second source, say that its lines were
      rephrased (step 06) and that duplicates were removed in ACLED's favour, and that crowd
      sizes / descriptions were shortened and translated with OpenAI. Hebrew first, then a
      Translation-Pending row; English and Arabic follow.
